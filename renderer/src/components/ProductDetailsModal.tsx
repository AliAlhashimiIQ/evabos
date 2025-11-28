import { useState, useEffect } from 'react';
import BarcodeLabelModal from './BarcodeLabelModal';
import './ProductDetailsModal.css';

type Product = import('../types/electron').Product;

interface ProductDetailsModalProps {
  product: Product;
  onClose: () => void;
}

const ProductDetailsModal = ({ product, onClose }: ProductDetailsModalProps): JSX.Element => {
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [, setExchangeRate] = useState<number>(1500);
  const [profitMargin, setProfitMargin] = useState<string>('—');

  useEffect(() => {
    const loadRate = async () => {
      if (!window.evaApi) return;
      try {
        const rateResponse = await window.evaApi.exchangeRates.getCurrent();
        const rate = rateResponse.currentRate?.rate || 1500;
        setExchangeRate(rate);

        if (product.avgCostUSD > 0) {
          const margin = (((product.salePriceIQD / rate - product.avgCostUSD) / product.avgCostUSD) * 100).toFixed(1);
          setProfitMargin(`${margin}%`);
        }
      } catch {
        // Keep default
      }
    };
    loadRate();
  }, [product]);

  return (
    <>
      <div className="ProductDetailsModal-overlay" onClick={onClose}>
        <div className="ProductDetailsModal-content" onClick={(e) => e.stopPropagation()}>
          <div className="ProductDetailsModal-header">
            <h2>Product Details</h2>
            <button className="ProductDetailsModal-close" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="ProductDetailsModal-body">
            <div className="ProductDetailsModal-section">
              <h3>Basic Information</h3>
              <div className="ProductDetailsModal-grid">
                <div className="ProductDetailsModal-field">
                  <label>Product Name</label>
                  <div className="ProductDetailsModal-value">{product.productName}</div>
                </div>
                <div className="ProductDetailsModal-field">
                  <label>Category</label>
                  <div className="ProductDetailsModal-value">{product.category ?? 'Uncategorized'}</div>
                </div>
                <div className="ProductDetailsModal-field">
                  <label>Product Code</label>
                  <div className="ProductDetailsModal-value">{product.baseCode ?? '—'}</div>
                </div>
                <div className="ProductDetailsModal-field">
                  <label>Supplier</label>
                  <div className="ProductDetailsModal-value">{product.supplierName ?? '—'}</div>
                </div>
                <div className="ProductDetailsModal-field">
                  <label>Status</label>
                  <div className="ProductDetailsModal-value">
                    <span className={`ProductDetailsModal-status ${product.isActive ? 'active' : 'inactive'}`}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="ProductDetailsModal-section">
              <h3>Variant Information</h3>
              <div className="ProductDetailsModal-grid">
                <div className="ProductDetailsModal-field">
                  <label>SKU</label>
                  <div className="ProductDetailsModal-value ProductDetailsModal-sku">{product.sku}</div>
                </div>
                <div className="ProductDetailsModal-field">
                  <label>Barcode (EAN-13)</label>
                  <div className="ProductDetailsModal-value ProductDetailsModal-barcode">
                    {product.barcode ?? 'Not assigned'}
                  </div>
                </div>
                <div className="ProductDetailsModal-field">
                  <label>Color</label>
                  <div className="ProductDetailsModal-value">{product.color ?? '—'}</div>
                </div>
                <div className="ProductDetailsModal-field">
                  <label>Size</label>
                  <div className="ProductDetailsModal-value">{product.size ?? '—'}</div>
                </div>
              </div>
            </div>

            <div className="ProductDetailsModal-section">
              <h3>Pricing & Costs</h3>
              <div className="ProductDetailsModal-grid">
                <div className="ProductDetailsModal-field">
                  <label>Sale Price (IQD)</label>
                  <div className="ProductDetailsModal-value ProductDetailsModal-price">
                    {product.salePriceIQD.toLocaleString('en-IQ')} IQD
                  </div>
                </div>
                <div className="ProductDetailsModal-field">
                  <label>Average Cost (USD)</label>
                  <div className="ProductDetailsModal-value">${product.avgCostUSD.toFixed(2)}</div>
                </div>
                <div className="ProductDetailsModal-field">
                  <label>Last Purchase Cost (USD)</label>
                  <div className="ProductDetailsModal-value">${product.lastPurchaseCostUSD.toFixed(2)}</div>
                </div>
                <div className="ProductDetailsModal-field">
                  <label>Profit Margin</label>
                  <div className="ProductDetailsModal-value">
                    {profitMargin}
                  </div>
                </div>
              </div>
            </div>

            <div className="ProductDetailsModal-section">
              <h3>Inventory</h3>
              <div className="ProductDetailsModal-grid">
                <div className="ProductDetailsModal-field">
                  <label>Stock On Hand</label>
                  <div className="ProductDetailsModal-value">
                    <span className={`ProductDetailsModal-stock ${product.stockOnHand <= 0 ? 'low' : ''}`}>
                      {product.stockOnHand.toLocaleString('en-IQ')} units
                    </span>
                  </div>
                </div>
                <div className="ProductDetailsModal-field">
                  <label>Variant ID</label>
                  <div className="ProductDetailsModal-value">#{product.id}</div>
                </div>
                <div className="ProductDetailsModal-field">
                  <label>Product ID</label>
                  <div className="ProductDetailsModal-value">#{product.productId}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="ProductDetailsModal-footer">
            {product.barcode && (
              <button
                className="ProductDetailsModal-printLabelButton"
                onClick={() => setShowLabelModal(true)}
              >
                🏷️ Print Label
              </button>
            )}
            <button className="ProductDetailsModal-closeButton" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      {showLabelModal && (
        <BarcodeLabelModal
          product={product}
          isOpen={showLabelModal}
          onClose={() => setShowLabelModal(false)}
        />
      )}
    </>
  );
};

export default ProductDetailsModal;

