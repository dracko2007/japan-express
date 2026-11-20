import React from 'react';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { MAX_VIDEO_MB } from '@/components/admin/productFormConstants';
import { Product } from '@/types';

interface ProductVideoSectionProps {
  editing: Product;
  setEditing: (value: React.SetStateAction<Product>) => void;
  videoRef: React.MutableRefObject<HTMLInputElement>;
  uploadingVideo: boolean;
  removeVideo: () => void;
  handleVideoFile: (files: FileList | null) => Promise<void>;
}

const ProductVideoSection: React.FC<ProductVideoSectionProps> = ({
  editing,
  setEditing,
  videoRef,
  uploadingVideo,
  removeVideo,
  handleVideoFile,
}) => {
  return (
    <>
    {/* Vídeo do produto */}
    <div>
      <label className="text-sm font-semibold block mb-1">Vídeo do produto (opcional, mp4)</label>
      {editing.video ? (
        <div className="flex items-start gap-3">
          <video
            src={editing.video}
            controls
            muted
            playsInline
            className="w-40 h-40 rounded-lg border border-border object-cover bg-black"
          />
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
              <input
                type="checkbox"
                checked={!!editing.videoCover}
                onChange={(e) => setEditing({ ...editing, videoCover: e.target.checked || undefined })}
                className="w-4 h-4 rounded accent-primary"
              />
              <span>🎬 <strong>Usar vídeo como capa</strong></span>
            </label>
            <p className="text-[11px] text-muted-foreground -mt-1 max-w-[220px]">
              {editing.videoCover
                ? 'O vídeo toca direto no card e na galeria — a 1ª foto vira o poster (thumbnail).'
                : 'Sem isso, o vídeo só toca ao passar o mouse sobre o produto.'}
            </p>
            <button
              type="button"
              onClick={() => videoRef.current?.click()}
              disabled={uploadingVideo}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 flex items-center gap-1.5"
            >
              {uploadingVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Trocar vídeo
            </button>
            <button
              type="button"
              onClick={removeVideo}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remover vídeo
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => videoRef.current?.click()}
          disabled={uploadingVideo}
          className="w-40 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition text-sm font-semibold"
        >
          {uploadingVideo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          {uploadingVideo ? 'Enviando…' : 'Adicionar vídeo'}
        </button>
      )}
      <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => handleVideoFile(e.target.files)} />
      <p className="text-xs text-muted-foreground mt-1">🎬 Mostrado ao passar o mouse sobre o produto na loja (hover). Máximo {MAX_VIDEO_MB}MB.</p>
    </div>
    </>
  );
};

export default ProductVideoSection;
