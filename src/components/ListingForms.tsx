import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Package, Clock, Tag, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MEAL_CATEGORIES } from '@/types';
import type { Listing } from '@/types';
import { Badge } from '@/components/Badge';
import Modal from '@/components/Modal';

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
    collection_window: '',
    allergen_info: '',
  });
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
        collection_window: editing.collection_window,
        allergen_info: editing.allergen_info,
      });
    } else {
      setForm({
        meal_name: '',
        description: '',
        category: 'Meals',
        quantity_available: '1',
        original_price: '',
        discounted_price: '',
        collection_window: '',
        allergen_info: '',
      });
    }
    setError(null);
  }, [editing, open]);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.meal_name.trim() || !form.description.trim() || !form.collection_window.trim()) {
      setError('Please fill in meal name, description, and collection window.');
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

    const payload = {
      business_id: businessId,
      meal_name: form.meal_name.trim(),
      description: form.description.trim(),
      category: form.category,
      quantity_available: qty,
      original_price: orig,
      discounted_price: disc,
      collection_window: form.collection_window.trim(),
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
            <label className="label-field">Meal Box Name *</label>
            <input
              type="text"
              value={form.meal_name}
              onChange={(e) => update('meal_name', e.target.value)}
              placeholder="Artisan Bread Bundle"
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
            placeholder="Describe what's in the box and why it's surplus…"
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
            <label className="label-field">Original Price (£) *</label>
            <input
              type="number"
              min="0"
              step="0.50"
              value={form.original_price}
              onChange={(e) => update('original_price', e.target.value)}
              placeholder="18.00"
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Discounted Price (£) *</label>
            <input
              type="number"
              min="0"
              step="0.50"
              value={form.discounted_price}
              onChange={(e) => update('discounted_price', e.target.value)}
              placeholder="7.50"
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="label-field">Collection Window *</label>
          <input
            type="text"
            value={form.collection_window}
            onChange={(e) => update('collection_window', e.target.value)}
            placeholder="Today 4:00 PM – 6:00 PM"
            className="input-field"
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
          Published listings appear in the customer marketplace automatically.
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
          <Package size={15} className="text-ink-400" /> {listing.quantity_available} box(es) available
        </div>
        <div className="flex items-center gap-2">
          <Tag size={15} className="text-ink-400" /> £{listing.discounted_price.toFixed(2)} (was £{listing.original_price.toFixed(2)})
        </div>
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-ink-400" /> {listing.collection_window}
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
