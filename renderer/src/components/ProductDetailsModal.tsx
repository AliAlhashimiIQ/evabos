import { useState, useEffect } from 'react';
import { X, Tag, Package, Layers, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';
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
          const margin = (
            ((product.salePriceIQD / rate - product.avgCostUSD) / product.avgCostUSD) *
            100
          ).toFixed(1);
          setProfitMargin(`${margin}%`);
          const profit = product.salePriceIQD - product.avgCostUSD * rate;
          setProfitAmountIQD(
            profit.toLocaleString('en-IQ', { maximumFractionDigits: 0 }) + ' IQD'
          );
        }
      } catch {
        // Keep default
      }
    };
    loadRate();
  }, [product]);

  return (
    <PortalModal onClose={onClose}>
      <div className="ProductDetailsModal-content">
        <div className="ProductDetailsModal-header">
          <h2>
            <Package size={20} style={{ color: 'var(--accent-primary)' }} />
            <span>{t('productDetails')}</span>
          </h2>
          <button className="ProductDetailsModal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="ProductDetailsModal-body">
          {/* 1. Basic Info */}
          <div className="ProductDetailsModal-section">
            <h3>
              <Package size={15} />
              <span>{t('basicInformation')}</span>
            </h3>
            <div className="ProductDetailsModal-grid">
              <div className="ProductDetailsModal-field">
                <label>{t('productName')}</label>
                <div className="ProductDetailsModal-value">{product.productName}</div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('category')}</label>
                <div className="ProductDetailsModal-value">
                  {product.category ?? t('uncategorized')}
                </div>
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
                <div className="ProductDetailsModal-value" style={{ background: 'transparent', border: 'none', padding: '0.2rem 0' }}>
                  <span
                    className={`ProductDetailsModal-status ${
                      product.isActive ? 'active' : 'inactive'
                    }`}
                  >
                    {product.isActive ? (
                      <>
                        <CheckCircle2 size={13} />
                        <span>{t('active') || 'نشط'}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={13} />
                        <span>{t('inactive') || 'معطل'}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Variant & Codes */}
          <div className="ProductDetailsModal-section">
            <h3>
              <Layers size={15} />
              <span>{t('variantInformation')}</span>
            </h3>
            <div className="ProductDetailsModal-grid">
              <div className="ProductDetailsModal-field">
                <label>{t('sku')}</label>
                <div className="ProductDetailsModal-value ProductDetailsModal-mono">
                  {product.sku || '—'}
                </div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('barcodeEAN')}</label>
                <div className="ProductDetailsModal-value ProductDetailsModal-mono">
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
              <div className="ProductDetailsModal-field">
                <label>{t('stockOnHand')}</label>
                <div className="ProductDetailsModal-value">
                  {product.stockOnHand.toLocaleString('en-IQ')} {t('items') || 'قطعة'}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Pricing & Margins */}
          <div className="ProductDetailsModal-section">
            <h3>
              <DollarSign size={15} />
              <span>{t('pricingAndCosts')}</span>
            </h3>
            <div className="ProductDetailsModal-grid">
              <div className="ProductDetailsModal-field">
                <label>{t('sellingPriceIQD')}</label>
                <div className="ProductDetailsModal-value" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                  {product.salePriceIQD.toLocaleString('en-IQ')} IQD
                </div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('avgCostUSDTitle')}</label>
                <div className="ProductDetailsModal-value">
                  ${product.avgCostUSD.toFixed(2)} USD
                </div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('markup')}</label>
                <div className="ProductDetailsModal-value" style={{ color: '#10b981', fontWeight: 700 }}>
                  {profitMargin}
                </div>
              </div>
              <div className="ProductDetailsModal-field">
                <label>{t('profitUSD')}</label>
                <div className="ProductDetailsModal-value" style={{ color: '#10b981', fontWeight: 700 }}>
                  {profitAmountIQD}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="ProductDetailsModal-footer">
          <button className="ProductDetailsModal-btn" onClick={onClose}>
            {t('close')}
          </button>
          {product.barcode && (
            <button
              className="ProductDetailsModal-btn primary"
              onClick={() => setShowLabelModal(true)}
            >
              <Tag size={16} />
              <span>{t('printLabel')}</span>
            </button>
          )}
        </div>

        {showLabelModal && (
          <BarcodeLabelModal product={product} onClose={() => setShowLabelModal(false)} />
        )}
      </div>
    </PortalModal>
  );
};

export default ProductDetailsModal;
