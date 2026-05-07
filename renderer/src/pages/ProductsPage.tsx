import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { FileDown, Plus, X, Tag } from 'lucide-react';
import ProductForm from '../components/ProductForm';
import ProductVariantTable from '../components/ProductVariantTable';
import InventoryAdjustModal from '../components/InventoryAdjustModal';
import ExcelImportModal from '../components/ExcelImportModal';
import ProductDetailsModal from '../components/ProductDetailsModal';
import BarcodeLabelModal from '../components/BarcodeLabelModal';
import BulkEditSeasonModal from '../components/BulkEditSeasonModal';
import './Pages.css';
import './ProductsPage.css';
import NumberInput from '../components/NumberInput';
import PortalModal from '../components/PortalModal';
import { confirmDialog } from '../utils/confirmDialog';
import { SkeletonTable } from '../components/Skeleton';

type Product = import('../types/electron').Product;
type ProductInput = import('../types/electron').ProductInput;
type Supplier = import('../types/electron').Supplier;

const ProductsPage = (): JSX.Element => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adjustVariant, setAdjustVariant] = useState<Product | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [viewDetailsProduct, setViewDetailsProduct] = useState<Product | null>(null);
  const [printLabelProduct, setPrintLabelProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editSeason, setEditSeason] = useState('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const fetchProducts = useCallback(async () => {
    if (!window.evaApi || !token) {
      setError('Desktop bridge is unavailable.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await window.evaApi.products.list(token);
      const sortedProducts = [...response.products].sort((a, b) => b.id - a.id);
      setProducts(sortedProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadProducts'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchProducts();
      // Fetch suppliers for filter
      window.evaApi.suppliers.list(token).then(setSuppliers).catch(console.error);
    }
  }, [fetchProducts, token]);

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      searchQuery === '' ||
      product.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSupplier =
      selectedSupplier === '' ||
      (product.supplierName && product.supplierName === selectedSupplier);

    const price = product.salePriceIQD;
    const min = minPrice === '' ? -Infinity : Number(minPrice);
    const max = maxPrice === '' ? Infinity : Number(maxPrice);
    const matchesPrice = price >= min && price <= max;

    // Hide deactivated products unless toggle is on
    // Handle both boolean false and numeric 0 (SQLite)
    const isActive = showDeactivated ? true : (product.isActive !== false && (product.isActive as any) !== 0);

    return matchesSearch && matchesSupplier && matchesPrice && isActive;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedSupplier('');
    setMinPrice('');
    setMaxPrice('');
    setShowDeactivated(false);
  };

  const handleCreateProduct = async (payload: ProductInput & { initialStock?: number }) => {
    if (!window.evaApi || !token) {
      setError('Desktop bridge is unavailable.');
      return;
    }

    try {
      setIsSubmitting(true);
      const newProduct = await window.evaApi.products.create(token, payload);

      // Handle initial stock if provided and non-zero
      if (payload.initialStock && payload.initialStock !== 0) {
        await window.evaApi.products.adjustStock(token, {
          variantId: newProduct.id,
          branchId: 1, // Default branch
          deltaQuantity: payload.initialStock,
          reason: 'initial_stock',
          note: 'Initial stock set during product creation',
        });
      }

      setIsModalOpen(false);
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToCreateProduct'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVariant = async (variant: Product) => {
    if (!window.evaApi || !token) return;
    if (!(await confirmDialog({ message: t('areYouSureDelete', { name: variant.productName, sku: variant.sku }), variant: 'danger', confirmText: t('delete') }))) {
      return;
    }
    try {
      await window.evaApi.products.deleteVariant(token, variant.id);
      await fetchProducts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Check for constraint violation or generic error
      if (errorMessage.includes('constraint') || errorMessage.includes('foreign key') || errorMessage.includes('Cannot delete variant')) {
        if (await confirmDialog({ message: t('deleteConstraintDeactivate', { name: variant.productName }) ||
          `Cannot delete "${variant.productName}" because it has sales history.\n\nWould you like to deactivate (archive) it instead?` })) {
          try {
            await window.evaApi.products.updateVariant(token, {
              id: variant.id,
              isActive: false
            });
            await fetchProducts();
            return;
          } catch (updateErr) {
            setError(updateErr instanceof Error ? updateErr.message : t('failedToDeactivate'));
          }
        }
      } else {
        setError(errorMessage || t('failedToDeleteVariant'));
      }
    }
  };

  const openEditModal = (product: Product) => {
    setEditProduct(product);
    setEditName(product.productName);
    setEditSeason(product.season ?? '');
    setEditPrice(product.salePriceIQD);
  };

  const handleEditProduct = async () => {
    if (!window.evaApi || !token || !editProduct) return;

    try {
      setIsEditSubmitting(true);

      // Update product name and season
      await window.evaApi.products.update(token, {
        id: editProduct.productId,
        name: editName,
        season: editSeason,
      });

      // Update variant price
      await window.evaApi.products.updateVariant(token, {
        id: editProduct.id,
        defaultPriceIQD: editPrice,
      });

      setEditProduct(null);
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToUpdateProduct'));
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map((p) => p.id));
    }
  };

  const handleBulkComplete = async () => {
    setIsBulkEditOpen(false);
    setSelectedIds([]);
    await fetchProducts();
  };

  return (
    <div className="Page Page--transparent">
      <div className="ProductsPage-header">
        <div>
          <h1>{t('products')}</h1>
          <p>{t('manageCatalog')}</p>
        </div>
        <div className="ProductsPage-actions">
          {selectedIds.length > 0 && (
            <button
              className="ProductsPage-bulkButton"
              onClick={() => setIsBulkEditOpen(true)}
            >
              <Tag size={18} /> {t('bulkUpdate')} ({selectedIds.length})
            </button>
          )}
          <button className="ProductsPage-importButton" onClick={() => setIsImportModalOpen(true)}>
            <FileDown size={18} /> {t('importExcel')}
          </button>
          <button className="ProductsPage-addButton" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> {t('addProduct')}
          </button>
        </div>
      </div>

      <div className="ProductsPage-filters">
        <div className="ProductsPage-filterGroup">
          <label>{t('search')}</label>
          <input
            type="text"
            className="ProductsPage-filterInput"
            placeholder={t('searchPlaceholder') || 'Name, SKU, Barcode...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="ProductsPage-filterGroup">
          <label>{t('supplier')}</label>
          <select
            className="ProductsPage-filterSelect"
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
          >
            <option value="">{t('allSuppliers') || 'All Suppliers'}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ProductsPage-filterGroup">
          <label>{t('minPrice')}</label>
          <NumberInput
            className="ProductsPage-filterInput"
            placeholder="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            min="0"
          />
        </div>

        <div className="ProductsPage-filterGroup">
          <label>{t('maxPrice')}</label>
          <NumberInput
            className="ProductsPage-filterInput"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            min="0"
          />
        </div>

        <div className="ProductsPage-filterGroup ProductsPage-checkboxGroup">
          <label>
            <input
              type="checkbox"
              checked={showDeactivated}
              onChange={(e) => setShowDeactivated(e.target.checked)}
            />
            <span>{t('showDeactivated') || 'Show Deactivated'}</span>
          </label>
        </div>

        {(searchQuery || selectedSupplier || minPrice || maxPrice || showDeactivated) && (
          <button className="ProductsPage-clearFilters" onClick={clearFilters}>
            <X size={16} /> {t('clearFilters') || 'Clear'}
          </button>
        )}
      </div>

      <datalist id="edit-seasons-list">
        {Array.from(new Set(products.map((p) => p.season).filter(Boolean))).map((s) => (
          <option key={s} value={s!} />
        ))}
      </datalist>

      {error && <div className="ProductsPage-alert">{error}</div>}

      <div className="ProductsPage-tableWrapper">
        {loading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : (
          <ProductVariantTable
            products={filteredProducts}
            actionLabel={t('adjustStock')}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onAction={(variantId) => {
              const variant = products.find((p) => p.id === variantId);
              if (variant) {
                setAdjustVariant(variant);
              }
            }}
            onViewDetails={(variant) => {
              setViewDetailsProduct(variant);
            }}
            onPrintLabel={(variant) => {
              setPrintLabelProduct(variant);
            }}
            onDelete={handleDeleteVariant}
            onEdit={openEditModal}
          />
        )}
      </div>

      {
        isModalOpen && (
          <PortalModal onClose={() => setIsModalOpen(false)}>
            <div className="ProductsPage-modal" style={{ width: 'min(640px, 90vw)' }}>
              <div className="ProductsPage-modalHeader">
                <h2>{t('addProduct')}</h2>
                <button className="ProductsPage-closeButton" onClick={() => setIsModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <ProductForm onSubmit={handleCreateProduct} onCancel={() => setIsModalOpen(false)} loading={isSubmitting} />
            </div>
          </PortalModal>
        )
      }

      {
        adjustVariant && (
          <InventoryAdjustModal
            variant={adjustVariant}
            onClose={() => setAdjustVariant(null)}
            onSubmit={async ({ variantId, deltaQuantity, reason, note }) => {
              if (!window.evaApi || !token) {
                setError(t('desktopBridgeUnavailable'));
                return;
              }
              try {
                await window.evaApi.products.adjustStock(token, {
                  variantId,
                  branchId: 1,
                  deltaQuantity,
                  reason,
                  note,
                });
                await fetchProducts();
              } catch (err) {
                setError(err instanceof Error ? err.message : t('failedToAdjustStock'));
              }
            }}
          />
        )
      }

      {
        isImportModalOpen && (
          <ExcelImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onSuccess={fetchProducts}
          />
        )
      }

      {
        viewDetailsProduct && (
          <ProductDetailsModal product={viewDetailsProduct} onClose={() => setViewDetailsProduct(null)} />
        )
      }

      {
        printLabelProduct && (
          <BarcodeLabelModal
            product={printLabelProduct}
            isOpen={!!printLabelProduct}
            onClose={() => setPrintLabelProduct(null)}
          />
        )
      }

      {editProduct && (
        <PortalModal onClose={() => setEditProduct(null)}>
          <div className="ProductsPage-modal ProductsPage-editModal" style={{ width: 'min(400px, 90vw)' }}>
            <div className="ProductsPage-modalHeader">
              <h2>{t('editProduct')}</h2>
              <button className="ProductsPage-closeButton" onClick={() => setEditProduct(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="ProductsPage-editForm">
              <label>
                {t('productName')}
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>
              <label>
                {t('season')}
                <input
                  type="text"
                  list="edit-seasons-list"
                  value={editSeason}
                  onChange={(e) => setEditSeason(e.target.value)}
                />
              </label>
              <label>
                {t('sellingPriceIQD')}
                <NumberInput
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value) || 0)}
                  min={0}
                />
              </label>
              <div className="ProductsPage-editActions">
                <button className="ProductsPage-cancelButton" onClick={() => setEditProduct(null)}>
                  {t('cancel')}
                </button>
                <button
                  className="ProductsPage-saveButton"
                  onClick={handleEditProduct}
                  disabled={isEditSubmitting}
                >
                  {isEditSubmitting ? t('saving') : t('save')}
                </button>
              </div>
            </div>
          </div>
        </PortalModal>
      )}
      {isBulkEditOpen && (
        <BulkEditSeasonModal
          productIds={Array.from(new Set(products.filter(p => selectedIds.includes(p.id)).map(p => p.productId)))}
          onClose={() => setIsBulkEditOpen(false)}
          onComplete={handleBulkComplete}
          existingSeasons={Array.from(new Set(products.map((p) => p.season).filter(Boolean))) as string[]}
        />
      )}
    </div>
  );
};

export default ProductsPage;

