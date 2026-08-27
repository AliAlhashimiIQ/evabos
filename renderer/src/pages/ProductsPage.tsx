import { useCallback, useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  FileDown,
  Plus,
  X,
  Tag,
  Loader2,
  Package,
  Search,
  AlertTriangle,
  Coins,
  Store,
  Layers,
  Sparkles,
} from 'lucide-react';
import ProductForm from '../components/ProductForm';
import ProductVariantTable from '../components/ProductVariantTable';
import InventoryAdjustModal from '../components/InventoryAdjustModal';
import ExcelImportModal from '../components/ExcelImportModal';
import ProductDetailsModal from '../components/ProductDetailsModal';
import BarcodeLabelModal from '../components/BarcodeLabelModal';
import BulkEditSeasonModal from '../components/BulkEditSeasonModal';
import Combobox from '../components/Combobox';
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
  const [, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
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

  const nextCursorRef = useRef<number | null>(null);
  const searchQueryRef = useRef<string>('');

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const fetchProducts = useCallback(
    async (isLoadMore = false) => {
      if (!window.evaApi || !token) {
        setError(t('desktopBridgeUnavailable') || 'Desktop bridge is unavailable.');
        return;
      }

      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const currentCursor = isLoadMore ? nextCursorRef.current : 0;
        const limit = 100;
        const queryToUse = searchQueryRef.current;

        const response = await window.evaApi.products.list(token, {
          limit,
          cursor: currentCursor,
          search: queryToUse,
        });

        if (isLoadMore) {
          setProducts((prev) => {
            const existingIds = new Set(prev.map((p: Product) => p.id));
            const newItems = response.items.filter((p: Product) => !existingIds.has(p.id));
            return [...prev, ...newItems];
          });
        } else {
          setProducts(response.items);
        }

        setNextCursor(response.nextCursor ?? null);
        nextCursorRef.current = response.nextCursor ?? null;
        setHasMore(response.hasMore ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('failedToLoadProducts'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token, t]
  );

  useEffect(() => {
    if (token && window.evaApi) {
      window.evaApi.suppliers.list(token).then(setSuppliers).catch(console.error);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => {
      fetchProducts(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, token, fetchProducts]);

  const filteredProducts = products.filter((product) => {
    const matchesSupplier =
      selectedSupplier === '' ||
      (product.supplierName && product.supplierName === selectedSupplier);

    const price = product.salePriceIQD;
    const min = minPrice === '' ? -Infinity : Number(minPrice);
    const max = maxPrice === '' ? Infinity : Number(maxPrice);
    const matchesPrice = price >= min && price <= max;

    const isActive = showDeactivated
      ? true
      : product.isActive !== false && (product.isActive as any) !== 0;

    return matchesSupplier && matchesPrice && isActive;
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
      setError(t('desktopBridgeUnavailable'));
      return;
    }

    try {
      setIsSubmitting(true);
      const newProduct = await window.evaApi.products.create(token, payload);

      if (payload.initialStock && payload.initialStock !== 0) {
        await window.evaApi.products.adjustStock(token, {
          variantId: newProduct.id,
          branchId: 1,
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
    if (
      !(await confirmDialog({
        message: t('areYouSureDelete', { name: variant.productName, sku: variant.sku }),
        variant: 'danger',
        confirmText: t('delete'),
      }))
    ) {
      return;
    }
    try {
      await window.evaApi.products.deleteVariant(token, variant.id);
      await fetchProducts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes('constraint') ||
        errorMessage.includes('foreign key') ||
        errorMessage.includes('Cannot delete variant')
      ) {
        if (
          await confirmDialog({
            message:
              t('deleteConstraintDeactivate', { name: variant.productName }) ||
              `Cannot delete "${variant.productName}" because it has sales history.\n\nWould you like to deactivate (archive) it instead?`,
          })
        ) {
          try {
            await window.evaApi.products.updateVariant(token, {
              id: variant.id,
              isActive: false,
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
      await window.evaApi.products.update(token, {
        id: editProduct.productId,
        name: editName,
        season: editSeason,
      });

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

  // KPIs
  const totalItemsCount = products.length;
  const totalStockUnits = products.reduce((sum, p) => sum + (p.stockOnHand || 0), 0);
  const lowStockCount = products.filter((p) => (p.stockOnHand || 0) <= 3).length;
  const totalInventoryValueIQD = products.reduce(
    (sum, p) => sum + (p.salePriceIQD || 0) * Math.max(p.stockOnHand || 0, 0),
    0
  );

  return (
    <div className="Page ProductsPage">
      {/* ── 1. Header Card ────────────────────────────────── */}
      <div className="ProductsPage-headerCard">
        <div className="ProductsPage-headerLeft">
          <div className="ProductsPage-brandIcon">
            <Package size={24} />
          </div>
          <div className="ProductsPage-headerTitles">
            <h1>{t('products')}</h1>
            <p>{t('manageCatalog') || 'إدارة المنتجات، الأصناف، والأسعار'}</p>
          </div>
        </div>

        <div className="ProductsPage-headerActions">
          {selectedIds.length > 0 && (
            <button
              className="ProductsPage-btn primary"
              onClick={() => setIsBulkEditOpen(true)}
            >
              <Tag size={16} />
              <span>
                {t('bulkUpdate')} ({selectedIds.length})
              </span>
            </button>
          )}
          <button
            className="ProductsPage-btn"
            onClick={() => setIsImportModalOpen(true)}
          >
            <FileDown size={16} />
            <span>{t('importExcel')}</span>
          </button>
          <button
            className="ProductsPage-btn primary"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={16} />
            <span>{t('addProduct')}</span>
          </button>
        </div>
      </div>

      {/* ── 2. KPI Summary Strip ───────────────────────────── */}
      <div className="ProductsPage-kpis">
        <div className="ProductsPage-kpiCard">
          <div className="ProductsPage-kpiIcon blue">
            <Package size={20} />
          </div>
          <div className="ProductsPage-kpiInfo">
            <span className="ProductsPage-kpiLabel">{t('activeProducts')}</span>
            <span className="ProductsPage-kpiVal">{totalItemsCount.toLocaleString('en-IQ')}</span>
          </div>
        </div>

        <div className="ProductsPage-kpiCard">
          <div className="ProductsPage-kpiIcon green">
            <Layers size={20} />
          </div>
          <div className="ProductsPage-kpiInfo">
            <span className="ProductsPage-kpiLabel">{t('stockOnHand')}</span>
            <span className="ProductsPage-kpiVal">{totalStockUnits.toLocaleString('en-IQ')}</span>
          </div>
        </div>

        <div className="ProductsPage-kpiCard">
          <div className="ProductsPage-kpiIcon amber">
            <AlertTriangle size={20} />
          </div>
          <div className="ProductsPage-kpiInfo">
            <span className="ProductsPage-kpiLabel">{t('lowStock')}</span>
            <span className="ProductsPage-kpiVal">{lowStockCount.toLocaleString('en-IQ')}</span>
          </div>
        </div>

        <div className="ProductsPage-kpiCard">
          <div className="ProductsPage-kpiIcon purple">
            <Coins size={20} />
          </div>
          <div className="ProductsPage-kpiInfo">
            <span className="ProductsPage-kpiLabel">{t('inventoryValue')}</span>
            <span className="ProductsPage-kpiVal">{totalInventoryValueIQD.toLocaleString('en-IQ')} IQD</span>
          </div>
        </div>
      </div>

      {/* ── 3. Filters Toolbar ────────────────────────────── */}
      <div className="ProductsPage-filterCard">
        <div className="ProductsPage-filterRow">
          {/* Instant Search Box */}
          <div className="ProductsPage-searchBox">
            <Search size={16} className="ProductsPage-searchIcon" />
            <input
              type="text"
              className="ProductsPage-searchInput"
              placeholder={t('searchPlaceholder') || 'بحث بالاسم، الباركود، أو رمز SKU...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Supplier Dropdown */}
          <div>
            <Combobox
              value={selectedSupplier}
              onChange={(val) => setSelectedSupplier(val)}
              options={suppliers.map((s) => s.name)}
              placeholder={t('allSuppliers') || 'جميع الموردين'}
            />
          </div>

          {/* Min Price */}
          <div>
            <NumberInput
              className="ProductsPage-priceInput"
              placeholder={t('minPrice') || 'أدنى سعر'}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              min="0"
            />
          </div>

          {/* Max Price */}
          <div>
            <NumberInput
              className="ProductsPage-priceInput"
              placeholder={t('maxPrice') || 'أعلى سعر'}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              min="0"
            />
          </div>

          {/* Show Deactivated Checkbox */}
          <label className="ProductsPage-toggleLabel">
            <input
              type="checkbox"
              checked={showDeactivated}
              onChange={(e) => setShowDeactivated(e.target.checked)}
            />
            <span>{t('showDeactivated') || 'إظهار المعطلة'}</span>
          </label>

          {/* Clear Filters */}
          {(searchQuery || selectedSupplier || minPrice || maxPrice || showDeactivated) && (
            <button className="ProductsPage-clearBtn" onClick={clearFilters}>
              <X size={14} />
              <span>{t('clearFilters') || 'إعادة تعيين'}</span>
            </button>
          )}
        </div>
      </div>

      {error && <div className="ProductsPage-alert">{error}</div>}

      {/* ── 4. Table ──────────────────────────────────────── */}
      <div className="ProductsPage-tableWrapper">
        {loading ? (
          <SkeletonTable rows={6} cols={6} />
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

      {!loading && hasMore && (
        <div className="ProductsPage-loadMoreContainer">
          <button
            className="ProductsPage-loadMoreBtn"
            disabled={loadingMore}
            onClick={() => fetchProducts(true)}
          >
            {loadingMore ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>{t('loading') || 'جاري التحميل...'}</span>
              </>
            ) : (
              <span>{t('loadMore') || 'تحميل المزيد من المنتجات'}</span>
            )}
          </button>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────── */}
      {isModalOpen && (
        <PortalModal onClose={() => setIsModalOpen(false)}>
          <div className="ProductsPage-modal" style={{ width: 'min(640px, 90vw)' }}>
            <div className="ProductsPage-modalHeader">
              <h2>{t('addProduct')}</h2>
              <button
                className="ProductsPage-closeButton"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <ProductForm
              onSubmit={handleCreateProduct}
              onCancel={() => setIsModalOpen(false)}
              loading={isSubmitting}
              existingSeasons={
                Array.from(new Set(products.map((p) => p.season).filter(Boolean))) as string[]
              }
            />
          </div>
        </PortalModal>
      )}

      {adjustVariant && (
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
      )}

      {isImportModalOpen && (
        <ExcelImportModal
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            fetchProducts();
          }}
        />
      )}

      {viewDetailsProduct && (
        <ProductDetailsModal
          product={viewDetailsProduct}
          onClose={() => setViewDetailsProduct(null)}
        />
      )}

      {printLabelProduct && (
        <BarcodeLabelModal
          product={printLabelProduct}
          onClose={() => setPrintLabelProduct(null)}
        />
      )}

      {editProduct && (
        <PortalModal onClose={() => setEditProduct(null)}>
          <div className="ProductsPage-modal" style={{ width: 'min(450px, 90vw)' }}>
            <div className="ProductsPage-modalHeader">
              <h2>{t('editProduct')}</h2>
              <button
                className="ProductsPage-closeButton"
                onClick={() => setEditProduct(null)}
              >
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEditProduct();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', padding: '1.5rem' }}
            >
              <div className="ProductsPage-formField">
                <label>{t('productName')}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="ProductsPage-searchInput"
                  style={{ padding: '0 0.85rem' }}
                  required
                />
              </div>

              <div className="ProductsPage-formField">
                <label>{t('season')}</label>
                <input
                  type="text"
                  value={editSeason}
                  onChange={(e) => setEditSeason(e.target.value)}
                  className="ProductsPage-searchInput"
                  style={{ padding: '0 0.85rem' }}
                  placeholder="e.g. Summer26"
                />
              </div>

              <div className="ProductsPage-formField">
                <label>{t('sellingPriceIQD')}</label>
                <NumberInput
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value))}
                  className="ProductsPage-searchInput"
                  style={{ padding: '0 0.85rem' }}
                  min="0"
                  required
                />
              </div>

              <div className="ProductsPage-modalActions">
                <button
                  type="button"
                  className="ProductsPage-btn"
                  onClick={() => setEditProduct(null)}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="ProductsPage-btn primary"
                  disabled={isEditSubmitting}
                >
                  {isEditSubmitting ? t('saving') : t('saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </PortalModal>
      )}

      {isBulkEditOpen && (
        <BulkEditSeasonModal
          selectedIds={selectedIds}
          onClose={() => setIsBulkEditOpen(false)}
          onSuccess={handleBulkComplete}
        />
      )}
    </div>
  );
};

export default ProductsPage;
