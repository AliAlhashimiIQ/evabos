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

type Product = import('../types/electron').Product;
type ProductInput = import('../types/electron').ProductInput;

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

  const fetchProducts = useCallback(async () => {
    if (!window.evaApi || !token) {
      setError('Desktop bridge is unavailable.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await window.evaApi.products.list(token);
      setProducts(response.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadProducts'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchProducts();
    }
  }, [fetchProducts, token]);

  const handleCreateProduct = async (payload: ProductInput) => {
    if (!window.evaApi || !token) {
      setError('Desktop bridge is unavailable.');
      return;
    }

    try {
      setIsSubmitting(true);
      await window.evaApi.products.create(token, payload);
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
    if (!window.confirm(t('areYouSureDelete', { name: variant.productName, sku: variant.sku }))) {
      return;
    }
    try {
      await window.evaApi.products.deleteVariant(token, variant.id);
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToDeleteVariant'));
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

      {error && <div className="ProductsPage-alert">{error}</div>}

      <div className="ProductsPage-tableWrapper">
        {loading ? (
          <div className="ProductsPage-empty">{t('loadingProducts')}</div>
        ) : (
          <ProductVariantTable
            products={products}
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
          />
        )}
      </div>

      {isModalOpen && (
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
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={fetchProducts}
        />
      )}

      {viewDetailsProduct && (
        <ProductDetailsModal product={viewDetailsProduct} onClose={() => setViewDetailsProduct(null)} />
      )}

      {printLabelProduct && (
        <BarcodeLabelModal
          product={printLabelProduct}
          isOpen={!!printLabelProduct}
          onClose={() => setPrintLabelProduct(null)}
        />
      )}
    </div>
  );
};

export default ProductsPage;

