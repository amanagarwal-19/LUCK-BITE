import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Package, Clock, Tag, AlertTriangle, ImagePlus, X  } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MEAL_CATEGORIES } from '@/types';
import type { Listing } from '@/types';
import { Badge } from '@/components/Badge';
import Modal from '@/components/Modal';
import { availabilityText } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const MAX_PHOTO_MB = 5;

export function ListingFormModal({
  open,
  onClose,
  businessId,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string;
  editing: Listing | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    meal_name: '',
    description: '',
    category: 'Meals',
    quantity_available: '1',
    original_price: '',
    discounted_price: '',
        available_hour: '',
    available_minute: '',
    allergen_info: '',
  });
    const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        meal_name: editing.meal_name,
        description: editing.description,
        category: editing.category,
        quantity_available: String(editing.quantity_available),
        original_price: String(editing.original_price),
        discounted_price: String(editing.discounted_price),
               available_hour: editing.available_until ? editing.available_until.split(':')[0] : '',
        available_minute: editing.available_until ? editing.available_until.split(':')[1] : '',
        allergen_info: editing.allergen_info,
      });
            setExistingPhotoUrl(editing.photo_url);
    } else {
      setForm({
        meal_name: '',
        description: '',
        category: 'Meals',
        quantity_available: '1',
        original_price: '',
        discounted_price: '',
               available_hour: '',
        available_minute: '',
        allergen_info: '',
      });
            setExistingPhotoUrl(null);
    }
        setPhotoFile(null);
    setPhotoPreview(null);
    setError(null);
  }, [editing, open]);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setError(`Photo is too large. Please choose an image under ${MAX_PHOTO_MB} MB.`);
      return;
    }
    setError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setExistingPhotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!form.meal_name.trim() || !form.description.trim()) {
      setError('Please fill in meal name and description.');
      return;
    }
    if (!form.available_hour || !form.available_minute) {
      setError('Please choose the "Available till" time.');
      return;
    }
    const orig = parseFloat(form.original_price);
    const disc = parseFloat(form.discounted_price);
    const qty = parseInt(form.quantity_available);

    if (isNaN(orig) || isNaN(disc) || orig < 0 || disc < 0) {
      setError('Please enter valid prices.');
      return;
    }
    if (disc > orig) {
      setError('Discounted price should be lower than the original price.');
      return;
    }
    if (isNaN(qty) || qty < 0) {
      setError('Please enter a valid quantity.');
      return;
    }

    setSaving(true);
    setError(null);
    
    let photoUrl: string | null = existingPhotoUrl;
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${businessId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('meal-photos')
        .upload(path, photoFile, { contentType: photoFile.type });
      if (uploadError) {
        setError('Could not upload the photo. Please try again, or save without a photo.');
        setSaving(false);
        return;
      }
      photoUrl = supabase.storage.from('meal-photos').getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      business_id: businessId,
      meal_name: form.meal_name.trim(),
      description: form.description.trim(),
      category: form.category,
      quantity_available: qty,
      original_price: orig,
      discounted_price: disc,
            available_until: `${form.available_hour}:${form.available_minute}`,
      photo_url: photoUrl,
      allergen_info: form.allergen_info.trim(),
    };

    let result;
    if (editing) {
      result = await supabase.from('listings').update(payload).eq('id', editing.id).select().single();
    } else {
      result = await supabase.from('listings').insert({ ...payload, is_active: true }).select().single();
    }

    if (result.error) {
      setError('Could not save the listing. Please try again.');
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Listing' : 'Add New Listing'} size="lg">
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Item / Meal Name *</label>
            <input
              type="text"
              value={form.meal_name}
              onChange={(e) => update('meal_name', e.target.value)}
              placeholder="Paneer Butter Masala"
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Category</label>
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              className="input-field"
            >
              {MEAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label-field">Description *</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Describe your food: what it is, how it tastes, serving size…"
            rows={3}
            className="input-field resize-none"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label-field">Quantity Available *</label>
            <input
              type="number"
              min="0"
              value={form.quantity_available}
              onChange={(e) => update('quantity_available', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Original Price (₹) *</label>
            <input
              type="number"
              min="0"
              step="0.50"
              value={form.original_price}
              onChange={(e) => update('original_price', e.target.value)}
              placeholder="300"
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Discounted Price (₹) *</label>
            <input
              type="number"
              min="0"
              step="0.50"
              value={form.discounted_price}
              onChange={(e) => update('discounted_price', e.target.value)}
              placeholder="150"
              className="input-field"
            />
          </div>
        </div>

                <div>
          <label className="label-field">Available till (24-hour time) *</label>
          <div className="flex items-center gap-2">
            <select
              value={form.available_hour}
              onChange={(e) => update('available_hour', e.target.value)}
              className="input-field"
              aria-label="Hour"
            >
              <option value="">Hour</option>
              {HOURS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span className="font-bold text-ink-600">:</span>
            <select
              value={form.available_minute}
              onChange={(e) => update('available_minute', e.target.value)}
              className="input-field"
              aria-label="Minute"
            >
              <option value="">Min</option>
              {MINUTES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-ink-400 mt-1">Customers can collect until this time. Example: 18:30</p>
        </div>

        <div>
          <label className="label-field">Item Photo (optional)</label>
          {photoPreview || existingPhotoUrl ? (
            <div className="relative w-full sm:w-64">
              <img
                src={photoPreview ?? existingPhotoUrl ?? ''}
                alt="Item preview"
                className="w-full h-40 object-cover rounded-xl border border-ink-900/10"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow-card hover:bg-white"
                aria-label="Remove photo"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-ink-900/15 py-6 flex flex-col items-center gap-1 text-ink-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
            >
              <ImagePlus size={24} />
              <span className="text-sm font-medium">Click to add a photo</span>
              <span className="text-xs text-ink-400">JPG, PNG or WebP, up to 5 MB</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        <div>
          <label className="label-field">Allergen & Storage Info</label>
          <textarea
            value={form.allergen_info}
            onChange={(e) => update('allergen_info', e.target.value)}
            placeholder="Contains wheat, dairy. Keep refrigerated."
            rows={2}
            className="input-field resize-none"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-error-100 border border-error-500/20 p-3">
            <p className="text-sm text-error-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : editing ? 'Update Listing' : 'Publish Listing'}
          </button>
        </div>
        <p className="text-center text-xs text-ink-400">
          Published listings appear in Discover Food for customers automatically.
        </p>
      </div>
    </Modal>
  );
}

export function ListingCard({
  listing,
  onEdit,
  onToggle,
  onDelete,
}: {
  listing: Listing;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const discount = listing.original_price > 0
    ? Math.round((1 - listing.discounted_price / listing.original_price) * 100)
    : 0;

  return (
    <div className={`card p-5 ${!listing.is_active ? 'opacity-60' : ''}`}>
            {listing.photo_url && (
        <img
          src={listing.photo_url}
          alt={listing.meal_name}
          loading="lazy"
          className="w-full h-40 object-cover rounded-xl mb-4"
        />
      )}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex gap-2 flex-wrap">
          <Badge variant="orange">{listing.category}</Badge>
          {discount > 0 && <Badge variant="green">-{discount}%</Badge>}
          {listing.quantity_available <= 0 && <Badge variant="error">Sold out</Badge>}
          {!listing.is_active && <Badge variant="neutral">Hidden</Badge>}
        </div>
      </div>

      <h3 className="font-bold text-lg text-ink-900 mb-1">{listing.meal_name}</h3>
      <p className="text-sm text-ink-600 leading-relaxed mb-3 line-clamp-2">{listing.description}</p>

      <div className="space-y-1.5 text-sm text-ink-500 mb-4">
        <div className="flex items-center gap-2">
          <Package size={15} className="text-ink-400" /> {listing.quantity_available} item{listing.quantity_available !== 1 ? 's' : ''} available
        </div>
        <div className="flex items-center gap-2">
          <Tag size={15} className="text-ink-400" /> ₹{listing.discounted_price.toFixed(2)} (was ₹{listing.original_price.toFixed(2)})
        </div>
        <div className="flex items-center gap-2">
         {availabilityText(listing)}
        </div>
        {listing.allergen_info && (
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="text-warning-500 mt-0.5" />
            <span className="line-clamp-1">{listing.allergen_info}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-ink-900/5">
        <button onClick={onEdit} className="btn-ghost text-sm">
          <Pencil size={15} /> Edit
        </button>
        <button onClick={onToggle} className="btn-ghost text-sm">
          {listing.is_active ? <><EyeOff size={15} /> Hide</> : <><Eye size={15} /> Show</>}
        </button>
        <button onClick={onDelete} className="btn-ghost text-sm text-error-700 hover:bg-error-100 ml-auto">
          <Trash2 size={15} /> Delete
        </button>
      </div>
    </div>
  );
}
