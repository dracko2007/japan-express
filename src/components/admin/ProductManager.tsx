import React, { useState, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, PackageOpen, Sparkles, Save, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { FEATURES } from '@/config/features';
import { Button } from '@/components/ui/button';
import { Product, ProductVariant } from '@/types';
import { getVariants, roundYen } from '@/utils/pricing';
import { generateUniqueSku } from '@/utils/sku';
import { useLanguage } from '@/context/LanguageContext';

import { useProducts } from '@/context/ProductsContext';
import { productService } from '@/services/productService';
import { cloudinaryService } from '@/services/cloudinaryService';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/context/UserContext';
import { sanitizePackageDimensions } from '@/utils/shippingDimensions';

import { categoryService, DEFAULT_CATEGORIES, type ProductCategory } from '@/services/categoryService';
import { useConfirm } from '@/components/ConfirmDialog';
import { authenticatedFetch } from '@/services/authenticatedFetch';
import { errorMessage } from '@/utils/errorMessage';
import { MAX_PHOTOS, MAX_VIDEO_MB } from '@/components/admin/productFormConstants';
import { slugify, fileToCompressedDataURL, urlToCompressedDataURL } from '@/utils/productImages';
import ProductVideoSection from '@/components/admin/product/ProductVideoSection';
import ProductPhotosSection from '@/components/admin/product/ProductPhotosSection';
import ProductDescriptionSection from '@/components/admin/product/ProductDescriptionSection';
import ProductPartnerStockSection from '@/components/admin/product/ProductPartnerStockSection';
import ProductStockSection from '@/components/admin/product/ProductStockSection';
import ProductTagsSection from '@/components/admin/product/ProductTagsSection';
import ProductHomeFeatureSection from '@/components/admin/product/ProductHomeFeatureSection';
import ProductVariantsSection from '@/components/admin/product/ProductVariantsSection';
import ProductListView from '@/components/admin/product/ProductListView';

const emptyForm = (): Product => ({
  id: '',
  name: '',
  description: '',
  category: 'cosmeticos',
  prices: { small: 0, large: 0 },
  variants: [{ id: 'small', label: 'Pequeno', price: 0 }],
  image: '',
  gallery: [],
  flavor: '',
});

const ProductManager: React.FC = () => {
  // Inclui os ocultos: é aqui que o admin os encontra para republicar.
  const { adminProducts: products, refresh } = useProducts();
  const { toast } = useToast();
  const { permissions } = useUser();
  const { language } = useLanguage();
  const confirm = useConfirm();
  const canPrice = permissions.canFinancial; // preço/custo só nível 3
  const [editing, setEditing] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichFields, setEnrichFields] = useState({ price: true, images: true, description: true, weight: true });
  const marginPct = 100;
  const [tagInput, setTagInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');

  // Categorias dinâmicas (padrão + personalizadas do Firestore)
  const [CATEGORIES, setCategories] = useState<ProductCategory[]>(DEFAULT_CATEGORIES);
  useEffect(() => {
    categoryService.getAll().then(setCategories).catch(() => {});
  }, []);
  const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label || id;
  const categoryIcon = (id: string) => CATEGORIES.find((c) => c.id === id)?.icon || '🌸';

  // Adicionar nova categoria
  const handleAddCategory = async () => {
    let cat = null as ProductCategory | null;
    const ok = await confirm({
      title: 'Adicionar nova categoria',
      confirmLabel: 'Adicionar',
      fields: [
        { name: 'label', label: 'Nome da categoria', required: true },
        { name: 'icon', label: 'Emoji/ícone (opcional)', defaultValue: '🏷️' },
      ],
      onConfirm: async (v) => {
        const label = (v.label || '').trim();
        if (!label) throw new Error('Informe o nome da categoria.');
        cat = await categoryService.add(label, (v.icon || '').trim() || '🏷️');
        if (!cat) throw new Error('Não foi possível adicionar a categoria.');
      },
    });
    if (!ok || !cat) return;
    setCategories(await categoryService.getAll());
    if (editing) setEditing({ ...editing, category: cat.id });
    toast({ title: '✅ Categoria adicionada', description: `${cat.icon} ${cat.label}` });
  };

  // Editar categoria personalizada (nome + emoji)
  const handleEditCategory = async () => {
    if (!editing) return;
    const id = editing.category;
    const current = CATEGORIES.find(c => c.id === id);
    if (!current || categoryService.isDefault(id)) {
      toast({ title: 'Categoria padrão não pode ser editada', variant: 'destructive' });
      return;
    }
    let icon = current.icon;
    let label = current.label;
    const ok = await confirm({
      title: `Editar a categoria ${current.label}`,
      confirmLabel: 'Salvar',
      fields: [
        { name: 'label', label: 'Nome da categoria', defaultValue: current.label, required: true },
        { name: 'icon', label: 'Emoji/ícone', defaultValue: current.icon },
      ],
      onConfirm: async (v) => {
        label = (v.label || '').trim();
        if (!label) throw new Error('Informe o nome da categoria.');
        icon = (v.icon || '').trim() || current.icon;
        if (!(await categoryService.update(id, label, icon))) throw new Error('Não foi possível editar a categoria.');
      },
    });
    if (!ok) return;
    setCategories(await categoryService.getAll());
    toast({ title: '✅ Categoria atualizada', description: `${icon} ${label}` });
  };

  // Deletar categoria personalizada
  const handleDeleteCategory = async () => {
    if (!editing) return;
    const id = editing.category;
    const current = CATEGORIES.find(c => c.id === id);
    if (!current || categoryService.isDefault(id)) {
      toast({ title: 'Categoria padrão não pode ser deletada', variant: 'destructive' });
      return;
    }
    const inUse = products.filter(p => p.category === id).length;
    const ok = await confirm({
      title: `Excluir a categoria ${current.label}?`,
      description: 'A categoria some da lista e dos filtros da loja.',
      details: inUse > 0
        ? [
            `${inUse} produto(s) continuam com o id "${id}" gravado, mas ficam sem categoria válida (não aparecem em nenhum grupo) até você escolher outra`,
            'Os produtos em si não são excluídos',
          ]
        : ['Nenhum produto usa esta categoria'],
      destructive: true,
      permission: 'delete',
      onConfirm: async () => {
        if (!(await categoryService.remove(id))) throw new Error('Não foi possível remover a categoria.');
      },
    });
    if (!ok) return;
    const updated = await categoryService.getAll();
    setCategories(updated);
    setEditing({ ...editing, category: updated[0]?.id || 'cosmeticos' });
    toast({ title: '🗑️ Categoria removida', description: current.label });
  };

  const filteredProducts = products.filter((p) => {
    const matchCat = filterCat === 'all' || p.category === filterCat;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const grouped = CATEGORIES.map((c) => ({
    ...c,
    items: filteredProducts.filter((p) => p.category === c.id),
  })).filter((g) => g.items.length > 0);

  const openNew = () => {
    setEditing(emptyForm());
    setIsNew(true);
    setTagInput('');
};
  const openEdit = (p: Product) => {
    // Abre com o preço salvo. O preço só é recalculado pelo custo quando o
    // custo é digitado (campo Custo): recalcular aqui trocava sozinho o preço
    // arredondado à mão (ex.: ¥980 virava ¥960) ao salvar qualquer outra coisa.
    setEditing({ ...p, gallery: p.gallery ? [...p.gallery] : [p.image], variants: getVariants(p) });
    setIsNew(false);
    setTagInput('');
  };

  // Link direto para a edição (?aba=products&editar=<id>), usado pela Auditoria
  // de Margem. Abre o produto assim que a lista carrega e limpa o parâmetro.
  const [searchParams, setSearchParams] = useSearchParams();
  const editParam = searchParams.get('editar');
  useEffect(() => {
    if (!editParam) return;
    const target = products.find((p) => p.id === editParam);
    if (!target) return;
    openEdit(target);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('editar');
      return next;
    }, { replace: true });
    // openEdit é recriado a cada render; só importa quando o id ou a lista mudam.
  }, [editParam, products, setSearchParams]);

  // Helpers das variantes de preço
  const variants = (): ProductVariant[] => editing?.variants || [];
  const setVariants = (vs: ProductVariant[]) => editing && setEditing({ ...editing, variants: vs });
  const addVariant = () => setVariants([...variants(), { id: `var-${Date.now().toString(36)}`, label: 'Médio', price: 0 }]);
  const updateVariant = (id: string, patch: Partial<ProductVariant>) =>
    setVariants(variants().map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const removeVariant = (id: string) => setVariants(variants().filter((v) => v.id !== id));
  const close = () => {
    setEditing(null);
    setIsNew(false);
    setTagInput('');
  };

  const addTag = () => {
    if (!editing || !tagInput.trim()) return;
    const newTags = tagInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    const existing = editing.tags || [];
    const merged = Array.from(new Set([...existing, ...newTags]));
    setEditing({ ...editing, tags: merged });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    if (!editing) return;
    setEditing({ ...editing, tags: (editing.tags || []).filter(t => t !== tag) });
  };

  // O admin digita em MILÍMETROS (mm), mas o armazenamento é em centímetros (cm).
  // Converte mm → cm (÷10) ao salvar no estado.
  const updatePackageDimension = (field: 'widthCm' | 'lengthCm' | 'heightCm', valueMm: string) => {
    if (!editing) return;
    const current = editing.packageDimensionsCm || { widthCm: 0, lengthCm: 0, heightCm: 0, source: 'manual' };
    const cm = (Number(valueMm) || 0) / 10; // mm → cm
    setEditing({
      ...editing,
      packageDimensionsCm: {
        ...current,
        [field]: cm,
        source: current.source || 'manual',
      },
    });
  };

  // Converte cm armazenado → mm para exibir no input. Vazio se 0.
  const dimMm = (cm?: number) => (cm && cm > 0 ? Math.round(cm * 10) : '');

  // Chama /api/product-enrich para preencher automaticamente descrição, preços e fotos.
  const handleEnrich = async () => {
    if (!editing || !editing.name.trim()) {
      toast({ title: 'Digite o nome do produto primeiro', variant: 'destructive' });
      return;
    }
    setEnriching(true);
    try {
      const res = await authenticatedFetch('/api/product-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: editing.name.trim(),
          targetLang: language || 'pt',
          markup: 1.5,
          fields: enrichFields,
          // Envia a primeira foto existente para OCR caso o nome não encontre resultado
          imageUrl: (editing.image && editing.image.startsWith('http')) ? editing.image
            : ((editing.gallery || []).find(g => g?.startsWith('http')) || undefined),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();

      // Mescla os dados recebidos mantendo o que o admin já preencheu manualmente
      const updatedEditing: Product = { ...editing };

      if (enrichFields.description && data.description) updatedEditing.description = data.description;
      // Traduções por idioma (pt/en/ja). Nome não entra no i18n: fica sempre em inglês.
      if (enrichFields.description && data.i18n && typeof data.i18n === 'object') {
        const currentI18n = Object.fromEntries(
          Object.entries(updatedEditing.i18n || {}).map(([lang, value]) => [
            lang,
            { description: value?.description || '' },
          ])
        ) as Product['i18n'];
        const incomingI18n = Object.fromEntries(
          Object.entries(data.i18n as Record<string, { description?: string } | null>).map(([lang, value]) => [
            lang,
            { description: value?.description || '' },
          ])
        ) as Product['i18n'];
        updatedEditing.i18n = { ...currentI18n, ...incomingI18n };
      }

      // Nome final sempre em inglês; substitui inclusive quando o admin digitou japonês.
      if (data.suggestName && data.suggestName !== editing.name) {
        updatedEditing.name = data.suggestName;
      }

      // Custo e preço de venda — sempre atualiza quando a IA retorna valor
      if (data.packageDimensionsCm) {
        const dimensions = sanitizePackageDimensions(data.packageDimensionsCm);
        if (dimensions) updatedEditing.packageDimensionsCm = dimensions;
      }

      if (enrichFields.weight && data.weightGrams != null && Number(data.weightGrams) > 0) {
        updatedEditing.weightGrams = Number(data.weightGrams);
        updatedEditing.weightVerified = false; // peso da IA é estimativa: mantém a margem
      }

      if (canPrice && enrichFields.price) {
        if (data.costYen) updatedEditing.cost = data.costYen;
        if (data.sellingPriceYen) {
          const vs = (updatedEditing.variants || []).length > 0
            ? updatedEditing.variants!
            : [{ id: 'small', label: 'Pequeno', price: 0 }];
          updatedEditing.variants = vs.map((v, i) =>
            i === 0 ? { ...v, price: data.sellingPriceYen } : v
          );
          updatedEditing.prices = { small: data.sellingPriceYen, large: data.sellingPriceYen };
        }
      }

      // Fotos do Yahoo/Rakuten — comprime para WebP antes de salvar (evita thumbnails de 6MB)
      if (enrichFields.images && Array.isArray(data.images) && data.images.length > 0) {
        const urls = [...new Set(data.images.filter(Boolean))].slice(0, MAX_PHOTOS) as string[];
        // Comprime em paralelo; fallback para URL original se CORS bloquear
        const compressed = await Promise.all(urls.map((u) => urlToCompressedDataURL(u)));
        updatedEditing.gallery = compressed;
        updatedEditing.image   = compressed[0] || updatedEditing.image;
      }

      setEditing(updatedEditing);
      const sourceLabel = data.source === 'yahoo' ? '🛒 Yahoo Shopping' : data.source === 'rakuten' ? '🛒 Rakuten' : '🤖 IA';
      const descSourceLabel =
        data.descriptionBaseSource === 'yahoo-page-description' ? 'descrição: página Yahoo + tradução IA'
        : data.descriptionBaseSource === 'yahoo-api-description' ? 'descrição: Yahoo API + tradução IA'
        : data.descriptionBaseSource === 'yahoo-headline' ? 'descrição: título/resumo Yahoo + tradução IA'
        : data.descriptionBaseSource === 'rakuten-api-description' ? 'descrição: Rakuten API + tradução IA'
        : 'descrição: gerada pela IA';
      toast({
        title: `✨ Produto enriquecido! (${sourceLabel})`,
        description: data.images?.length
          ? `${data.images.length} foto(s) · ${descSourceLabel} · custo ¥${data.costYen?.toLocaleString() || '–'} · venda ¥${data.sellingPriceYen?.toLocaleString() || '–'}`
          : `${descSourceLabel} · custo ¥${data.costYen?.toLocaleString() || '–'} · venda ¥${data.sellingPriceYen?.toLocaleString() || '–'}`,
      });
    } catch (e) {
      toast({ title: 'Erro ao enriquecer produto', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setEnriching(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !editing) return;
    setUploading(true);
    try {
      const current = editing.gallery ? [...editing.gallery] : [];
      for (const file of Array.from(files).slice(0, MAX_PHOTOS)) {
        if (current.length >= MAX_PHOTOS) break;
        const dataUrl = await fileToCompressedDataURL(file);
        current.push(dataUrl);
      }
      setEditing({ ...editing, gallery: current, image: current[0] || editing.image });
    } catch (e) {
      toast({ title: 'Erro ao processar imagem', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => {
    if (!editing) return;
    const gallery = (editing.gallery || []).filter((_, i) => i !== idx);
    setEditing({ ...editing, gallery, image: gallery[0] || '' });
  };

  // Reordenar fotos por arrastar (a primeira é sempre a capa)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const moveImage = (from: number, to: number) => {
    if (!editing || from === to || from < 0 || to < 0) return;
    const g = [...(editing.gallery || [])];
    if (from >= g.length || to >= g.length) return;
    const [moved] = g.splice(from, 1);
    g.splice(to, 0, moved);
    setEditing({ ...editing, gallery: g, image: g[0] || '' });
  };

  // Marca uma foto como capa (move para o topo) e desativa o vídeo como capa — só um dos dois pode ser a capa.
  const setPhotoAsCover = (idx: number) => {
    if (!editing) return;
    if (idx !== 0) moveImage(idx, 0);
    setEditing((prev) => (prev ? { ...prev, videoCover: undefined } : prev));
  };

  const handleVideoFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !editing) return;
    if (!file.type.startsWith('video/')) {
      toast({ title: 'Selecione um arquivo de vídeo (mp4, webm, mov)', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast({ title: `Vídeo muito grande`, description: `Máximo ${MAX_VIDEO_MB}MB. Comprima o arquivo e tente novamente.`, variant: 'destructive' });
      return;
    }
    setUploadingVideo(true);
    try {
      const folder = `japanexpress/product-videos/${editing.id || 'temp-' + Date.now()}`;
      const url = await cloudinaryService.uploadVideoFile(file, folder);
      setEditing((prev) => (prev ? { ...prev, video: url } : prev));
      toast({ title: '✅ Vídeo enviado' });
    } catch (e) {
      toast({ title: 'Erro ao enviar vídeo', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setUploadingVideo(false);
      if (videoRef.current) videoRef.current.value = '';
    }
  };

  const removeVideo = () => {
    if (!editing) return;
    setEditing({ ...editing, video: undefined, videoCover: undefined });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast({ title: 'Dê um nome ao produto', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const id = isNew ? slugify(editing.name) + '-' + Date.now().toString(36).slice(-4) : editing.id;
      const rawGallery = editing.gallery && editing.gallery.length > 0 ? editing.gallery : [editing.image].filter(Boolean);

      // ── Upload de imagens para Cloudinary CDN ────────────────────────────
      const folder = `japanexpress/products/${id}`;

      const toCdnUrl = async (imgStr: string): Promise<string> => {
        if (!imgStr) return '';
        if (cloudinaryService.isCloudinaryUrl(imgStr) || cloudinaryService.isFirebaseUrl(imgStr)) return imgStr;
        let dataUrl = imgStr;
        if (cloudinaryService.isExternalUrl(imgStr)) {
          dataUrl = await urlToCompressedDataURL(imgStr);
        }
        return cloudinaryService.uploadDataUrl(dataUrl, folder);
      };

      // Capa primeiro (precisamos do data URL ainda em memória para o thumb)
      const rawCover = rawGallery[0] || '';
      const coverUrl = await toCdnUrl(rawCover);

      // Thumbnail HD 1200px a partir do data URL original
      let thumbnailUrl = editing.thumbnail || '';
      const needNewThumb = rawCover && !cloudinaryService.isCloudinaryUrl(rawCover) && !cloudinaryService.isFirebaseUrl(rawCover);
      // Capa trocada por uma foto que já estava hospedada (galeria reordenada,
      // outra foto escolhida como capa): a miniatura antiga era de outra foto e
      // o card mostrava uma imagem e a página do produto outra. Usa a nova capa.
      const savedCover = isNew ? '' : products.find((p) => p.id === editing.id)?.image || '';
      if (!needNewThumb && coverUrl && coverUrl !== savedCover) thumbnailUrl = coverUrl;
      if (needNewThumb) {
        const thumbData = await urlToCompressedDataURL(
          cloudinaryService.isDataUrl(rawCover) ? rawCover : coverUrl,
          1600,
          0.95
        );
        thumbnailUrl = await cloudinaryService.uploadDataUrl(thumbData, folder);
      }

      // Demais fotos da galeria
      const galleryUrls = await Promise.all(
        rawGallery.map((img, i) => i === 0 ? Promise.resolve(coverUrl) : toCdnUrl(img))
      );
      // ─────────────────────────────────────────────────────────────────────

      const cleanVariants: ProductVariant[] = (editing.variants || [])
        .filter((v) => v.label.trim() && Number(v.price) > 0)
        .map((v) => ({ id: v.id, label: v.label.trim(), price: roundYen(Number(v.price)) }));
      const priceVals = cleanVariants.map((v) => v.price);
      const small = roundYen(priceVals.length ? Math.min(...priceVals) : Number(editing.prices?.small) || 0);
      const large = roundYen(priceVals.length ? Math.max(...priceVals) : Number(editing.prices?.large) || small);
      const packageDimensionsCm = sanitizePackageDimensions(editing.packageDimensionsCm);

      // SKU único por categoria — gerado automaticamente na criação (ou se faltar ao editar).
      // Lê todos os produtos do banco, inclusive ocultos e apagados: a lista da tela não
      // tem os apagados, e gerar só a partir dela repetia o SKU de produto antigo.
      const sku = editing.sku?.trim() || generateUniqueSku(editing.category, await productService.listAllSkus());

      const product: Product = {
        ...editing,
        id,
        sku,
        image: coverUrl || editing.image || '',
        thumbnail: thumbnailUrl || undefined,
        gallery: galleryUrls.filter(Boolean),
        // undefined = custo não carregado/não informado → o salvo é mantido.
        cost: editing.cost === undefined ? undefined : Number(editing.cost) || 0,
        variants: cleanVariants.length ? cleanVariants : undefined,
        prices: { small, large },
        packageDimensionsCm: packageDimensionsCm || undefined,
        // Com o 3D desligado, o campo some do formulário e o valor salvo é preservado.
        model3d: !FEATURES.product3d
          ? editing.model3d
          : editing.model3d?.src?.trim()
            ? {
                src: editing.model3d.src.trim(),
                iosSrc: editing.model3d.iosSrc?.trim() || undefined,
                poster: coverUrl || undefined,
              }
            : undefined,
      };
      await productService.save(product);
      await refresh();
      toast({
        title: isNew ? '✅ Produto adicionado!' : '✅ Produto atualizado!',
        description: `${product.name} · ${product.gallery?.length ?? 0} foto(s) salva(s) no Firestore`,
      });
      close();
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Product) => {
    const ok = await confirm({
      title: `Excluir o produto ${p.name}?`,
      description: 'O produto deixa de aparecer na loja.',
      details: [
        'É uma exclusão lógica: o registro fica marcado como removido no banco',
        'Pedidos e avaliações já existentes continuam com o nome do produto',
      ],
      destructive: true,
      permission: 'delete',
      onConfirm: async () => {
        await productService.remove(p.id);
        await refresh();
      },
    });
    if (!ok) return;
    toast({ title: '🗑️ Produto removido', description: p.name });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Produtos</h2>
          <p className="text-sm text-muted-foreground">{products.length} produtos na loja</p>
        </div>
        <Button onClick={openNew} className="btn-primary rounded-xl gap-2">
          <Plus className="w-5 h-5" /> Adicionar Produto
        </Button>
      </div>

      {/* Filtros */}
      <div className="mb-6 space-y-3">
        {/* Barra de pesquisa */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar produto por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtro de categoria */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterCat('all')}
            className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition', filterCat === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/50')}
          >
            Todos ({products.length})
          </button>
          {CATEGORIES.map((c) => {
            const count = products.filter((p) => p.category === c.id).length;
            if (count === 0) return null;
            return (
              <button
                key={c.id}
                onClick={() => setFilterCat(filterCat === c.id ? 'all' : c.id)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition', filterCat === c.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/50')}
              >
                {c.icon} {c.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Resultado da busca */}
        {(searchQuery || filterCat !== 'all') && (
          <p className="text-xs text-muted-foreground">
            {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
            {searchQuery && <> para "<strong>{searchQuery}</strong>"</>}
            {filterCat !== 'all' && <> em <strong>{CATEGORIES.find(c => c.id === filterCat)?.label}</strong></>}
          </p>
        )}
      </div>

      <ProductListView
        grouped={grouped}
        setSearchQuery={setSearchQuery}
        setFilterCat={setFilterCat}
        openEdit={openEdit}
        remove={remove}
      />
      {/* Modal de edição */}
      {editing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-2xl h-[min(90vh,780px)] flex flex-col shadow-elevated border border-border">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border shrink-0 bg-card rounded-t-2xl">
              <h3 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
                {isNew ? <Plus className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
                {isNew ? 'Novo Produto' : 'Editar Produto'}
              </h3>
              <button onClick={close} className="p-2 rounded-full hover:bg-secondary"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
              {/* Nome + botão de enriquecimento */}
              <div>
                <label className="text-sm font-semibold block mb-1">Nome do produto</label>
                <div className="flex gap-2">
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Ex: Kit Kat Matcha, Bioré UV SPF50+"
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background"
                  />
                  <button
                    type="button"
                    onClick={handleEnrich}
                    disabled={enriching || !editing.name.trim()}
                    title="Busca descrição, fotos, preço e medidas no Yahoo/Rakuten + IA"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    {enriching
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Sparkles className="w-4 h-4" />}
                    <span className="hidden sm:inline">{enriching ? 'Buscando…' : 'Auto-preencher'}</span>
                    <span className="sm:hidden">{enriching ? '…' : 'IA'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  ✨ <strong>Auto-preencher</strong>: busca descrição, preço, peso, medidas da embalagem e até 5 fotos automaticamente via Rakuten/Yahoo.
                </p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-[11px] text-muted-foreground font-medium">Buscar:</span>
                  {([
                    { key: 'price', label: 'Valor' },
                    { key: 'images', label: 'Imagens' },
                    { key: 'description', label: 'Descrição' },
                    { key: 'weight', label: 'Peso' },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={enrichFields[key]}
                        onChange={(e) => setEnrichFields(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="w-3.5 h-3.5 rounded accent-amber-500"
                      />
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* SKU (código do produto) */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold shrink-0">SKU</span>
                <span className="text-xs font-mono px-2 py-1 rounded bg-secondary text-secondary-foreground break-all">
                  {editing.sku || (isNew ? 'Gerado automaticamente ao salvar' : '—')}
                </span>
              </div>

              {/* GTIN / JAN (código de barras para Google Merchant) */}
              <div>
                <label className="text-sm font-semibold block mb-1">Código de barras (JAN/EAN-13)</label>
                <input
                  value={editing.gtin ?? ''}
                  onChange={(e) => setEditing({ ...editing, gtin: e.target.value.trim().replace(/\D/g, '') || undefined })}
                  inputMode="numeric"
                  placeholder="Ex: 4901301234567 (13 dígitos do código de barras da embalagem)"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Com o código real, o produto passa a aparecer no Google Shopping com marca (bem casado). <strong>Sem código</strong>, o item continua elegível mas como "sem identificador". Não invente — código errado suspende a conta do Merchant.
                </p>
              </div>

              {/* Categoria + Sabor/tag */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold block mb-1">Categoria</label>
                  <div className="flex gap-2">
                    <select
                      value={editing.category}
                      onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-background min-w-0"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      title="Adicionar nova categoria"
                      className="shrink-0 px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1 text-sm font-semibold"
                    >
                      <Plus className="w-4 h-4" /> Nova
                    </button>
                  </div>
                  {/* Editar/Deletar — só para categorias personalizadas */}
                  {!categoryService.isDefault(editing.category) && (
                    <div className="flex gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={handleEditCategory}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Editar categoria
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteCategory}
                        className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Deletar categoria
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-1">Tag / Sabor</label>
                  <input
                    value={editing.flavor}
                    onChange={(e) => setEditing({ ...editing, flavor: e.target.value })}
                    placeholder="Ex: Matcha Kyoto"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  />
                </div>
              </div>

              <ProductVariantsSection
                variants={variants}
                updateVariant={updateVariant}
                canPrice={canPrice}
                removeVariant={removeVariant}
                addVariant={addVariant}
              />

              {/* Desconto promocional + Ocultar */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-3">
                  <label className="text-sm font-semibold block mb-1 flex items-center gap-1.5">🏷️ Desconto (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={editing.discountPercent || ''}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(99, Number(e.target.value) || 0));
                      setEditing({ ...editing, discountPercent: v });
                    }}
                    placeholder="0 = sem promoção"
                    disabled={!canPrice}
                    className="w-full px-3 py-2 rounded-lg border border-red-300 bg-background disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {editing.discountPercent && variants()[0]?.price ? (
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1.5">
                      De <s>¥{variants()[0].price.toLocaleString()}</s> por <strong>¥{Math.round(variants()[0].price * (1 - editing.discountPercent / 100)).toLocaleString()}</strong> ({variants()[0].label})
                    </p>
                  ) : (
                    <p className="text-[11px] text-red-600/70 mt-1.5">Mostra a tag de promoção no produto.</p>
                  )}
                </div>

                <div className="bg-secondary/40 border border-border rounded-lg p-3 flex flex-col justify-center">
                  <label className="text-sm font-semibold block mb-2 flex items-center gap-1.5">👁️ Publicação</label>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, hidden: !editing.hidden })}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                      editing.hidden
                        ? 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300'
                        : 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-300'
                    }`}
                  >
                    <span>{editing.hidden ? '🙈 Oculto (não aparece)' : '✅ Publicado na loja'}</span>
                    <span className={`w-9 h-5 rounded-full relative transition-colors ${editing.hidden ? 'bg-gray-400' : 'bg-green-500'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-[left] ${editing.hidden ? 'left-0.5' : 'left-4'}`} />
                    </span>
                  </button>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Oculto = fica registrado, mas o cliente não vê.</p>
                </div>

                <ProductHomeFeatureSection
                  editing={editing}
                  setEditing={setEditing}
                  products={products}
                />
              </div>

              <ProductTagsSection
                editing={editing}
                removeTag={removeTag}
                tagInput={tagInput}
                setTagInput={setTagInput}
                addTag={addTag}
                setEditing={setEditing}
              />
              <ProductStockSection
                editing={editing}
                setEditing={setEditing}
              />
              <ProductPartnerStockSection
                editing={editing}
                setEditing={setEditing}
                marginPct={marginPct}
                variants={variants}
                canPrice={canPrice}
                dimMm={dimMm}
                updatePackageDimension={updatePackageDimension}
              />
              <ProductDescriptionSection
                editing={editing}
                setEditing={setEditing}
              />
              <ProductPhotosSection
                editing={editing}
                setDragIndex={setDragIndex}
                dragIndex={dragIndex}
                moveImage={moveImage}
                setPhotoAsCover={setPhotoAsCover}
                removeImage={removeImage}
                fileRef={fileRef}
                uploading={uploading}
                handleFiles={handleFiles}
              />
              <ProductVideoSection
                editing={editing}
                setEditing={setEditing}
                videoRef={videoRef}
                uploadingVideo={uploadingVideo}
                removeVideo={removeVideo}
                handleVideoFile={handleVideoFile}
              />

              {/* Modelo 3D (aba "3D" + AR na página do produto) — desligado em FEATURES.product3d */}
              {FEATURES.product3d && (
              <div>
                <label className="text-sm font-semibold block mb-1">Modelo 3D (opcional, .glb)</label>
                <input
                  type="url"
                  inputMode="url"
                  placeholder="https://…/produto.glb  ou  /models/produto.glb"
                  value={editing.model3d?.src || ''}
                  onChange={(e) => {
                    const src = e.target.value;
                    setEditing({ ...editing, model3d: src ? { ...editing.model3d, src } : undefined });
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                {editing.model3d?.src && (
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="(opcional) .usdz para AR mais fiel no iPhone"
                    value={editing.model3d.iosSrc || ''}
                    onChange={(e) => editing.model3d && setEditing({
                      ...editing,
                      model3d: { ...editing.model3d, iosSrc: e.target.value || undefined },
                    })}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  🧊 Aparece como aba “3D” na galeria: o cliente gira o produto e pode ver no próprio espaço (AR) pelo celular.
                </p>
              </div>
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-border flex justify-end gap-3 shrink-0 bg-card rounded-b-2xl">
              <Button variant="outline" onClick={close} className="rounded-xl">Cancelar</Button>
              <Button onClick={save} disabled={saving} className="btn-primary rounded-xl gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      {products.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <PackageOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
          Nenhum produto. Clique em "Adicionar Produto" para começar.
        </div>
      )}
    </div>
  );
};

export default ProductManager;
