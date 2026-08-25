import React from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

export const PRESET_PERK_IMAGES = [
  { label: 'Auto Care', url: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=700&auto=format&fit=crop&q=80' },
  { label: 'Healthcare', url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=700&auto=format&fit=crop&q=80' },
  { label: 'Legal Aid', url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=700&auto=format&fit=crop&q=80' },
  { label: 'Gas Station', url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=700&auto=format&fit=crop&q=80' },
  { label: 'Phone & Tech', url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=700&auto=format&fit=crop&q=80' },
  { label: 'Tax Service', url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=700&auto=format&fit=crop&q=80' },
  { label: 'Restaurants', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&auto=format&fit=crop&q=80' },
  { label: 'Wellness', url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=700&auto=format&fit=crop&q=80' },
];

export const PRESET_LOGOS = [
  { name: 'Meineke', url: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=120&auto=format&fit=crop&q=80' },
  { name: 'Stride', url: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=120&auto=format&fit=crop&q=80' },
  { name: 'Legal Shield', url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=120&auto=format&fit=crop&q=80' },
  { name: 'GasBuddy', url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=120&auto=format&fit=crop&q=80' },
  { name: 'Shield Logo', url: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=120&auto=format&fit=crop&q=80' },
  { name: 'Tech Mobile', url: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=120&auto=format&fit=crop&q=80' },
];

interface PerkImageUploadControlProps {
  category?: string;
  imageUrl: string;
  setImageUrl?: (url: string) => void;
  onImageUrlChange?: (url: string) => void;
  logoUrl: string;
  setLogoUrl?: (url: string) => void;
  onLogoUrlChange?: (url: string) => void;
}

export const PerkImageUploadControl: React.FC<PerkImageUploadControlProps> = ({
  imageUrl,
  setImageUrl,
  onImageUrlChange,
  logoUrl,
  setLogoUrl,
  onLogoUrlChange,
}) => {
  const handleImageUrlChange = onImageUrlChange || setImageUrl || (() => {});
  const handleLogoUrlChange = onLogoUrlChange || setLogoUrl || (() => {});
  return (
    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
      {/* Perk Banner / Cover Image */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[#111827] font-semibold text-xs flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-[#005FB8]" />
            <span>Perk Cover Photo / Banner (Optional)</span>
          </label>
          {imageUrl && (
            <button
              type="button"
              onClick={() => handleImageUrlChange('')}
              className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Remove Photo</span>
            </button>
          )}
        </div>

        {imageUrl && (
          <div className="relative h-28 w-full rounded-lg overflow-hidden border border-slate-300 bg-slate-100 mb-2 shadow-2xs">
            <img
              src={imageUrl}
              alt="Perk preview"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
              Cover Preview
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 hover:border-[#005FB8] rounded-lg bg-white cursor-pointer transition-colors text-slate-700 text-xs font-medium">
            <Upload className="w-4 h-4 text-[#005FB8]" />
            <span>Upload Image File (PNG, JPG, WebP)</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    if (typeof ev.target?.result === 'string') {
                      handleImageUrlChange(ev.target.result);
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>

          <input
            type="url"
            value={imageUrl.startsWith('data:') ? '' : imageUrl}
            onChange={(e) => handleImageUrlChange(e.target.value)}
            placeholder="Or paste public image URL: https://..."
            className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8]"
          />

          {/* Presets */}
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              1-Click Photo Presets:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {PRESET_PERK_IMAGES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleImageUrlChange(preset.url)}
                  className="px-2 py-1 rounded bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[10.5px] text-slate-700 font-medium whitespace-nowrap cursor-pointer shrink-0 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Brand / Merchant Logo */}
      <div className="pt-2.5 border-t border-slate-200">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[#111827] font-semibold text-xs">
            Brand / Provider Logo (Optional)
          </label>
          {logoUrl && (
            <button
              type="button"
              onClick={() => handleLogoUrlChange('')}
              className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Remove Logo</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo preview"
              className="w-9 h-9 rounded-lg object-contain bg-white border border-slate-300 p-0.5 shadow-2xs shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 text-[10px] font-bold shrink-0">
              Logo
            </div>
          )}

          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <label className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border border-dashed border-slate-300 hover:border-[#005FB8] rounded-lg bg-white cursor-pointer transition-colors text-slate-700 text-xs font-medium">
                <Upload className="w-3.5 h-3.5 text-[#005FB8]" />
                <span>Upload Logo File</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        if (typeof ev.target?.result === 'string') {
                          handleLogoUrlChange(ev.target.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>

            <input
              type="url"
              value={logoUrl.startsWith('data:') ? '' : logoUrl}
              onChange={(e) => handleLogoUrlChange(e.target.value)}
              placeholder="Or paste logo URL..."
              className="w-full bg-white border border-gray-300 rounded-lg p-1.5 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8]"
            />
          </div>
        </div>

        {/* Logo presets */}
        <div className="mt-1.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {PRESET_LOGOS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleLogoUrlChange(p.url)}
                className="px-2 py-0.5 rounded bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[10px] text-slate-700 font-medium whitespace-nowrap cursor-pointer shrink-0 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
