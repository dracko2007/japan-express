import React from 'react';
import { MAX_PHOTOS } from '@/components/admin/productFormConstants';
import { cn } from '@/lib/utils';
import { GripVertical, Star, X, Loader2, Plus } from 'lucide-react';
import { Product } from '@/types';

interface ProductPhotosSectionProps {
  editing: Product;
  setDragIndex: (value: React.SetStateAction<number>) => void;
  dragIndex: number;
  moveImage: (from: number, to: number) => void;
  setPhotoAsCover: (idx: number) => void;
  removeImage: (idx: number) => void;
  fileRef: React.MutableRefObject<HTMLInputElement>;
  uploading: boolean;
  handleFiles: (files: FileList | null) => Promise<void>;
}

const ProductPhotosSection: React.FC<ProductPhotosSectionProps> = ({
  editing,
  setDragIndex,
  dragIndex,
  moveImage,
  setPhotoAsCover,
  removeImage,
  fileRef,
  uploading,
  handleFiles,
}) => {
  return (
    <>
    {/* Fotos */}
    <div>
      <label className="text-sm font-semibold block mb-1">Fotos (até {MAX_PHOTOS}) — arraste para reordenar</label>
      <div className="flex flex-wrap gap-3">
        {(editing.gallery || []).map((img, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={() => setDragIndex(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (dragIndex !== null) moveImage(dragIndex, idx); setDragIndex(null); }}
            onDragEnd={() => setDragIndex(null)}
            className={cn(
              "relative w-20 h-20 rounded-lg overflow-hidden border-2 group cursor-grab active:cursor-grabbing transition",
              dragIndex === idx ? "border-primary opacity-50 scale-95" : "border-border"
            )}
            title="Arraste para reordenar"
          >
            <img src={img} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover pointer-events-none" />
            {idx === 0 ? (
              <span className={cn(
                "absolute top-0 left-0 text-[9px] px-1 rounded-br font-bold",
                editing.videoCover ? "bg-black/50 text-white" : "bg-primary text-primary-foreground"
              )}>
                {editing.videoCover ? 'Poster' : 'Capa'}
              </span>
            ) : (
              <span className="absolute top-0 left-0 bg-black/50 text-white text-[9px] px-1 rounded-br">{idx + 1}</span>
            )}
            <span className="absolute bottom-0.5 left-0.5 bg-black/50 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition">
              <GripVertical className="w-3 h-3" />
            </span>
            {(idx !== 0 || editing.videoCover) && (
              <button
                type="button"
                onClick={() => setPhotoAsCover(idx)}
                title="Usar esta foto como capa"
                className="absolute bottom-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition"
              >
                <Star className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => removeImage(idx)}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {(editing.gallery?.length || 0) < MAX_PHOTOS && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      <p className="text-xs text-muted-foreground mt-1">
        🖱️ Arraste para reordenar — a <strong>primeira é a capa</strong>. Passe o mouse e clique na <Star className="w-3 h-3 inline -mt-0.5" /> de outra foto para torná-la a capa. As imagens são reduzidas automaticamente.
      </p>
    </div>

    </>
  );
};

export default ProductPhotosSection;
