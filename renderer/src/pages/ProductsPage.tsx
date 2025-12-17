import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import ProductForm from '../components/ProductForm';
import ProductVariantTable from '../components/ProductVariantTable';
import InventoryAdjustModal from '../components/InventoryAdjustModal';
import ExcelImportModal from '../components/ExcelImportModal';
import ProductDetailsModal from '../components/ProductDetailsModal';
import BarcodeLabelModal from '../components/BarcodeLabelModal';
import './Pages.css';
import './ProductsPage.css';
import NumberInput from '../components/NumberInput';
import { confirmDialog } from '../utils/confirmDialog';

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
  const [editPrice, setEditPrice] = useState<number>(0);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

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
    if (!confirmDialog(t('areYouSureDelete', { name: variant.productName, sku: variant.sku }))) {
      return;
    }
    try {
      await window.evaApi.products.deleteVariant(token, variant.id);
      await fetchProducts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Check for constraint violation or generic error
      if (errorMessage.includes('constraint') || errorMessage.includes('foreign key') || errorMessage.includes('Cannot delete variant')) {
        if (confirmDialog(t('deleteConstraintDeactivate', { name: variant.productName }) ||
          `Cannot delete "${variant.productName}" because it has sales history.\n\nWould you like to deactivate (archive) it instead?`)) {
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
    setEditPrice(product.salePriceIQD);
  };

  const handleEditProduct = async () => {
    if (!window.evaApi || !token || !editProduct) return;

    try {
      setIsEditSubmitting(true);

      // Update product name
      await window.evaApi.products.update(token, {
        id: editProduct.productId,
        name: editName,
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

  return (
    <div className="Page Page--transparent">
      <div className="ProductsPage-header">
        <div>
          <h1>{t('products')}</h1>
          <p>{t('manageCatalog')}</p>
        </div>
        <div className="ProductsPage-actions">
          <button className="ProductsPage-importButton" onClick={() => setIsImportModalOpen(true)}>
            📥 {t('importExcel')}
          </button>
          <button className="ProductsPage-addButton" onClick={() => setIsModalOpen(true)}>
            + {t('addProduct')}
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
            ✕ {t('clearFilters') || 'Clear'}
          </button>
        )}
      </div>

      {error && <div className="ProductsPage-alert">{error}</div>}

      <div className="ProductsPage-tableWrapper">
        {loading ? (
          <div className="ProductsPage-empty">{t('loadingProducts')}</div>
        ) : (
          <ProductVariantTable
            products={filteredProducts}
            actionLabel={t('adjustStock')}
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
          <div className="ProductsPage-modalOverlay">
            <div className="ProductsPage-modal">
              <div className="ProductsPage-modalHeader">
                <h2>{t('addProduct')}</h2>
                <button className="ProductsPage-closeButton" onClick={() => setIsModalOpen(false)}>
                  ✕
                </button>
              </div>
              <ProductForm onSubmit={handleCreateProduct} onCancel={() => setIsModalOpen(false)} loading={isSubmitting} />
            </div>
          </div>
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
        <div className="ProductsPage-modalOverlay">
          <div className="ProductsPage-modal ProductsPage-editModal">
            <div className="ProductsPage-modalHeader">
              <h2>{t('editProduct')}</h2>
              <button className="ProductsPage-closeButton" onClick={() => setEditProduct(null)}>
                ✕
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
        </div>
      )}
    </div >
  );
};

export default ProductsPage;

