import { useLanguage } from '../contexts/LanguageContext';
import { Eye, Tag, Pencil, Trash2, SlidersHorizontal, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import './ProductVariantTable.css';

type Product = import('../types/electron').Product;

interface ProductVariantTableProps {
  products: Product[];
  actionLabel?: string;
  onAction?: (variantId: number) => void;
  onViewDetails?: (variant: Product) => void;
  onPrintLabel?: (variant: Product) => void;
  onDelete?: (variant: Product) => void;
  onEdit?: (variant: Product) => void;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
  onToggleSelectAll?: (ids: number[]) => void;
}

const ProductVariantTable = ({
  products,
  onAction,
  onViewDetails,
  onPrintLabel,
  onDelete,
  onEdit,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
}: ProductVariantTableProps): JSX.Element => {
  const { t } = useLanguage();
  const allSelected = products.length > 0 && selectedIds.length === products.length;

  if (!products.length) {
    return (
      <div className="ProductVariantTable-empty">
        <p>{t('noData')}</p>
      </div>
    );
  }

  const renderStockBadge = (stock: number) => {
    if (stock <= 0) {
      return (
        <span className="ProductVariantTable-stockBadge out-of-stock">
          <XCircle size={11} />
          <span>{stock} {t('badgeOutOfStock')}</span>
        </span>
      );
    }
    if (stock <= 3) {
      return (
        <span className="ProductVariantTable-stockBadge low-stock">
          <AlertTriangle size={11} />
          <span>{stock} {t('badgeLowStock')}</span>
        </span>
      );
    }
    return (
      <span className="ProductVariantTable-stockBadge in-stock">
        <CheckCircle2 size={11} />
        <span>{stock.toLocaleString('en-IQ')} {t('badgeInStock')}</span>
      </span>
    );
  };

  return (
    <div className="ProductVariantTable-container">
      <table className="ProductVariantTable">
        <thead>
          <tr>
            {onToggleSelectAll && (
              <th className="ProductVariantTable-checkboxCell">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleSelectAll(products.map((p) => p.id))}
                />
              </th>
            )}
            <th>{t('productName')}</th>
            <th>{t('sku')}</th>
            <th>{t('barcode')}</th>
            <th>{t('variantInformation') || 'المتغير'}</th>
            <th>{t('sellingPriceIQD')}</th>
            <th>{t('avgCostUSD')}</th>
            <th>{t('stock')}</th>
            <th style={{ textAlign: 'center', width: '130px' }}>{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((variant) => {
            const isSelected = selectedIds.includes(variant.id);
            const variantTag = [variant.color, variant.size].filter(Boolean).join(' • ');

            return (
              <tr key={variant.id} className={isSelected ? 'selected' : ''}>
                {onToggleSelect && (
                  <td className="ProductVariantTable-checkboxCell">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(variant.id)}
                    />
                  </td>
                )}
                <td>
                  <div className="ProductVariantTable-nameCell">
                    <span className="ProductVariantTable-title">{variant.productName}</span>
                    <div className="ProductVariantTable-meta">
                      {variant.category && (
                        <span className="ProductVariantTable-metaTag">{variant.category}</span>
                      )}
                      {variant.season && (
                        <span className="ProductVariantTable-metaTag">{variant.season}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span className="ProductVariantTable-codeMono">{variant.sku || '—'}</span>
                </td>
                <td>
                  <span className="ProductVariantTable-codeMono" title={variant.barcode ?? ''}>
                    {variant.barcode || '—'}
                  </span>
                </td>
                <td>
                  {variantTag ? (
                    <span className="ProductVariantTable-variantBadge">{variantTag}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <span className="ProductVariantTable-price">
                    {variant.salePriceIQD.toLocaleString('en-IQ')} IQD
                  </span>
                </td>
                <td>
                  <span className="ProductVariantTable-cost">
                    ${(variant.avgCostUSD || 0).toFixed(2)}
                  </span>
                </td>
                <td>{renderStockBadge(variant.stockOnHand)}</td>
                <td style={{ textAlign: 'center' }}>
                  <div className="ProductVariantTable-actionsGroup">
                    {onAction && (
                      <button
                        className="ProductVariantTable-actBtn adjust"
                        onClick={() => onAction(variant.id)}
                        title={t('adjustStock')}
                      >
                        <SlidersHorizontal size={13} />
                      </button>
                    )}
                    {onPrintLabel && variant.barcode && (
                      <button
                        className="ProductVariantTable-actBtn"
                        onClick={() => onPrintLabel(variant)}
                        title={t('printLabel')}
                      >
                        <Tag size={13} />
                      </button>
                    )}
                    {onViewDetails && (
                      <button
                        className="ProductVariantTable-actBtn"
                        onClick={() => onViewDetails(variant)}
                        title={t('viewDetails')}
                      >
                        <Eye size={13} />
                      </button>
                    )}
                    {onEdit && (
                      <button
                        className="ProductVariantTable-actBtn"
                        onClick={() => onEdit(variant)}
                        title={t('edit')}
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        className="ProductVariantTable-actBtn danger"
                        onClick={() => onDelete(variant)}
                        title={t('delete')}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ProductVariantTable;
