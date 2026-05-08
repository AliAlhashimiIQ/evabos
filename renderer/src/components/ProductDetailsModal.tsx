import { useState, useEffect } from 'react';
import { X, Tag } from 'lucide-react';
import BarcodeLabelModal from './BarcodeLabelModal';
import './ProductDetailsModal.css';
import PortalModal from './PortalModal';
import { useLanguage } from '../contexts/LanguageContext';

type Product = import('../types/electron').Product;

interface ProductDetailsModalProps {
  product: Product;
  onClose: () => void;
}

const ProductDetailsModal = ({ product, onClose }: ProductDetailsModalProps): JSX.Element => {
  const { t } = useLanguage();
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(1500);
  const [profitMargin, setProfitMargin] = useState<string>('—');
  const [profitAmountIQD, setProfitAmountIQD] = useState<string>('—');

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
          const profit = product.salePriceIQD - (product.avgCostUSD * rate);
          setProfitAmountIQD(profit.toLocaleString('en-IQ', { maximumFractionDigits: 0 }) + ' IQD');
        }
      } catch {
        // Keep default
      }
    };
    loadRate();
  }, [product]);

  return (
    <PortalModal onClose={onClose}>
      <div className="ProductDetailsModal-content" style={{ width: 'min(800px, 95vw)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="ProductDetailsModal-header">
          <h2>{t('productDetails')}</h2>
          <button className="ProductDetailsModal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="ProductDetailsModal-body">
          <div className="ProductDetailsModal-section">
            <h3>{t('basicInformation')}</h3>
            <div className="ProductDetailsModal-grid">
              <div className="ProductDetailsModal-field">
                <label>{t('productName')}</label>
                <div className="ProductDetailsModal-value">{product.productName}</div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('category')}</label>
                <div className="ProductDetailsModal-value">{product.category ?? t('uncategorized')}</div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('code')}</label>
                <div className="ProductDetailsModal-value">{product.baseCode ?? '—'}</div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('season')}</label>
                <div className="ProductDetailsModal-value">{product.season ?? '—'}</div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('supplier')}</label>
                <div className="ProductDetailsModal-value">{product.supplierName ?? '—'}</div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('status')}</label>
                <div className="ProductDetailsModal-value">
                  <span className={`ProductDetailsModal-status ${product.isActive ? 'active' : 'inactive'}`}>
                    {product.isActive ? t('active') : t('inactive')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="ProductDetailsModal-section">
            <h3>{t('variantInformation')}</h3>
            <div className="ProductDetailsModal-grid">
              <div className="ProductDetailsModal-field">
                <label>{t('sku')}</label>
                <div className="ProductDetailsModal-value ProductDetailsModal-sku">{product.sku}</div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('barcodeEAN')}</label>
                <div className="ProductDetailsModal-value ProductDetailsModal-barcode">
                  {product.barcode ?? t('notAssigned')}
                </div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('color')}</label>
                <div className="ProductDetailsModal-value">{product.color ?? '—'}</div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('size')}</label>
                <div className="ProductDetailsModal-value">{product.size ?? '—'}</div>
              </div>
            </div>
          </div>

          <div className="ProductDetailsModal-section">
            <h3>{t('pricingAndCosts')}</h3>
            <div className="ProductDetailsModal-grid">
              <div className="ProductDetailsModal-field">
                <label>{t('sellingPriceIQD')}</label>
                <div className="ProductDetailsModal-value ProductDetailsModal-price">
                  {product.salePriceIQD.toLocaleString('en-IQ')} IQD
                </div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('avgCostUSDTitle')}</label>
                <div className="ProductDetailsModal-value">${product.avgCostUSD.toFixed(2)}</div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('profitAmount')} (IQD)</label>
                <div className="ProductDetailsModal-value">{profitAmountIQD}</div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('profitMargin')}</label>
                <div className="ProductDetailsModal-value">
                  {profitMargin}
                </div>
              </div>
            </div>
          </div>

          <div className="ProductDetailsModal-section">
            <h3>{t('inventoryTitle')}</h3>
            <div className="ProductDetailsModal-grid">
              <div className="ProductDetailsModal-field">
                <label>{t('stockOnHand')}</label>
                <div className="ProductDetailsModal-value">
                  <span className={`ProductDetailsModal-stock ${product.stockOnHand <= 0 ? 'low' : ''}`}>
                    {product.stockOnHand.toLocaleString('en-IQ')}
                  </span>
                </div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('variantId')}</label>
                <div className="ProductDetailsModal-value">#{product.id}</div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('productId')}</label>
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
              <Tag size={18} /> {t('printLabel')}
            </button>
          )}
          <button className="ProductDetailsModal-closeButton" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
      {showLabelModal && (
        <BarcodeLabelModal
          product={product}
          isOpen={showLabelModal}
          onClose={() => setShowLabelModal(false)}
        />
      )}
    </PortalModal>
  );
};

export default ProductDetailsModal;

