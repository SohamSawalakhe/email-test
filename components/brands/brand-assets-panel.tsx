"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Star, Trash2, Loader2, Check, PenLine, Link2, Image as ImageIcon, ExternalLink } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

interface Asset {
  id: string;
  name: string;
  isDefault: boolean;
  content?: string;   // signature text
  imageUrl?: string;  // signature image
  imageLink?: string; // signature image link
  text?: string;      // cta button label
  link?: string;      // cta url / header image url
  imageUrl_header?: string;
}

interface BrandAssets {
  signatures: Asset[];
  ctas: Asset[];
  headers: Asset[];
}

interface Props {
  brandId: string;
  assets: BrandAssets;
  onAssetsChange: (assets: BrandAssets) => void;
}

type AssetType = "signature" | "cta" | "header";

const TABS: { id: AssetType; label: string; icon: React.ElementType; color: string }[] = [
  { id: "signature", label: "Signatures", icon: PenLine, color: "text-violet-400" },
  { id: "cta", label: "CTAs", icon: Link2, color: "text-emerald-400" },
  { id: "header", label: "Headers", icon: ImageIcon, color: "text-sky-400" },
];

function InputField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
      />
    </div>
  );
}

function AddForm({ type, brandId, onAdd }: { type: AssetType; brandId: string; onAdd: (item: Asset) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", content: "", imageUrl: "", imageLink: "",
    text: "", link: "", isDefault: false,
  });

  const f = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const signatureRef = useRef<HTMLDivElement>(null);

  const handleSignaturePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            document.execCommand('insertHTML', false, `<img src="${base64}" alt="Pasted Image" style="max-height: 100px; margin: 4px 0;" />`);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  async function submit() {
    try {
      setLoading(true);
      const res = await axios.post(`/api/brands/${brandId}/assets`, { type, ...form });
      onAdd(res.data.item);
      toast.success("Asset added");
      setOpen(false);
      setForm({ name: "", content: "", imageUrl: "", imageLink: "", text: "", link: "", isDefault: false });
    } catch {
      toast.error("Failed to add asset");
    } finally {
      setLoading(false);
    }
  }

  const label = type === "signature" ? "Signature" : type === "cta" ? "CTA" : "Header";

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-4 rounded-xl border border-border bg-muted/30 space-y-3">
              <InputField label="Label" value={form.name} onChange={(v) => f("name", v)} placeholder={`e.g. Formal ${label}, Campaign ${label}`} />

              {type === "signature" && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Signature Content (Paste rich text & images here)</label>
                    <div
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onBlur={(e) => f("content", e.currentTarget.innerHTML)}
                      onPaste={handleSignaturePaste}
                      className="w-full min-h-[6rem] max-h-48 overflow-y-auto px-3 py-2 rounded-lg bg-white text-black border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-text"
                      dangerouslySetInnerHTML={{ __html: form.content }}
                    />
                  </div>
                </>
              )}

              {type === "cta" && (
                <>
                  <InputField label="Button Text" value={form.text} onChange={(v) => f("text", v)} placeholder="Book a Call" />
                  <InputField label="URL" value={form.link} onChange={(v) => f("link", v)} placeholder="https://calendly.com/..." />
                </>
              )}

              {type === "header" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Header Image Upload</label>
                  <div className="flex items-center gap-4 p-3 bg-background border border-border rounded-lg">
                    {form.imageUrl && (
                      <img src={form.imageUrl} alt="Preview" className="w-16 h-10 object-cover rounded shadow-sm border border-border" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="text-xs text-muted-foreground file:mr-3 file:py-1 file:px-2.5 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => f("imageUrl", event.target?.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => f("isDefault", e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                Set as default
              </label>

              <div className="flex gap-2">
                <button
                  onClick={submit}
                  disabled={loading || !form.name}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AssetCard({
  item,
  type,
  brandId,
  onSetDefault,
  onDelete,
}: {
  item: Asset;
  type: AssetType;
  brandId: string;
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [loadingDefault, setLoadingDefault] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);

  async function setDefault() {
    try {
      setLoadingDefault(true);
      await axios.patch(`/api/brands/${brandId}/assets/${item.id}`, { type, setDefault: true });
      onSetDefault(item.id);
      toast.success("Default updated");
    } catch {
      toast.error("Failed to update default");
    } finally {
      setLoadingDefault(false);
    }
  }

  async function remove() {
    try {
      setLoadingDelete(true);
      await axios.delete(`/api/brands/${brandId}/assets/${item.id}`, { data: { type } });
      onDelete(item.id);
      toast.success("Asset removed");
    } catch {
      toast.error("Failed to delete asset");
    } finally {
      setLoadingDelete(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`relative p-3.5 rounded-xl border transition-all ${
        item.isDefault
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:border-border/80"
      }`}
    >
      {item.isDefault && (
        <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-wider">
          <Star className="w-3 h-3 fill-primary" /> Default
        </span>
      )}

      <p className="text-sm font-semibold text-foreground pr-16">{item.name}</p>

      {type === "signature" && (
        <div className="mt-2">
          {item.content && (
            <div 
              className="text-xs text-muted-foreground line-clamp-3 bg-white/50 p-2 rounded border border-border/50 overflow-hidden"
              dangerouslySetInnerHTML={{ __html: item.content }}
            />
          )}
        </div>
      )}

      {type === "cta" && (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{item.text}</span>
          {item.link && <span> → {item.link}</span>}
        </p>
      )}

      {type === "header" && (
        <div className="mt-2 h-16 rounded-lg overflow-hidden bg-muted">
          <img src={(item as any).imageUrl} alt={item.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        {!item.isDefault && (
          <button
            onClick={setDefault}
            disabled={loadingDefault}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {loadingDefault ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
            Set Default
          </button>
        )}
        <button
          onClick={remove}
          disabled={loadingDelete}
          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-muted hover:bg-destructive/10 hover:text-destructive transition-colors ml-auto"
        >
          {loadingDelete ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          Delete
        </button>
      </div>
    </motion.div>
  );
}

export function BrandAssetsPanel({ brandId, assets, onAssetsChange }: Props) {
  const [activeTab, setActiveTab] = useState<AssetType>("signature");

  function addItem(type: AssetType, item: Asset) {
    const key = `${type}s` as keyof BrandAssets;
    onAssetsChange({ ...assets, [key]: [...(assets[key] as Asset[]), item] });
  }

  function setDefault(type: AssetType, id: string) {
    const key = `${type}s` as keyof BrandAssets;
    onAssetsChange({
      ...assets,
      [key]: (assets[key] as Asset[]).map((a) => ({ ...a, isDefault: a.id === id })),
    });
  }

  function removeItem(type: AssetType, id: string) {
    const key = `${type}s` as keyof BrandAssets;
    onAssetsChange({ ...assets, [key]: (assets[key] as Asset[]).filter((a) => a.id !== id) });
  }

  const items = assets[`${activeTab}s` as keyof BrandAssets] as Asset[];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = (assets[`${tab.id}s` as keyof BrandAssets] as Asset[]).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? tab.color : ""}`} />
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Add Button */}
      <AddForm type={activeTab} brandId={brandId} onAdd={(item) => addItem(activeTab, item)} />

      {/* Asset List */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="space-y-2"
        >
          {items.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              No {activeTab}s saved yet. Add one above.
            </div>
          ) : (
            <AnimatePresence>
              {items.map((item) => (
                <AssetCard
                  key={item.id}
                  item={item}
                  type={activeTab}
                  brandId={brandId}
                  onSetDefault={(id) => setDefault(activeTab, id)}
                  onDelete={(id) => removeItem(activeTab, id)}
                />
              ))}
            </AnimatePresence>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
