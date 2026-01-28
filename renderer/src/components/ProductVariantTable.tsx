import { useLanguage } from '../contexts/LanguageContext';
import { Eye, Tag, Pencil, Trash2 } from 'lucide-react';
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
}

const ProductVariantTable = ({
  products,
  actionLabel,
  onAction,
  onViewDetails,
  onPrintLabel,
  onDelete,
  onEdit,
}: ProductVariantTableProps): JSX.Element => {
  const { t } = useLanguage();
  const defaultActionLabel = actionLabel || t('adjustStock');

  if (!products.length) {
    return <div className="ProductsPage-empty">{t('noData')}</div>;
  }

  return (
    <div className="ProductVariantTable-wrapper">
      <table className="ProductVariantTable">
        <thead>
          <tr>
            <th>{t('name')}</th>
            <th>{t('sku')}</th>
            <th>{t('barcode')}</th>
            <th>{t('color')}</th>
            <th>{t('size')}</th>
            <th>{t('priceIQD')}</th>
            <th>{t('avgCostUSD')}</th>
            <th>{t('stock')}</th>
            <th>{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((variant) => (
            <tr key={variant.id}>
              <td>
                <div className="ProductVariantTable-name">
                  <strong>{variant.productName}</strong>
                  <span>{variant.category ?? 'Uncategorized'}</span>
                </div>
              </td>
              <td>
                <span className="ProductVariantTable-sku">{variant.sku}</span>
              </td>
              <td>
                <span className="ProductVariantTable-barcode" title={variant.barcode ?? 'No barcode'}>
                  {variant.barcode ?? '—'}
                </span>
              </td>
              <td>{variant.color ?? '—'}</td>
              <td>{variant.size ?? '—'}</td>
              <td>{variant.salePriceIQD.toLocaleString('en-IQ')}</td>
              <td>{variant.avgCostUSD.toFixed(2)}</td>
              <td>
                <span className={`ProductVariantTable-stock ${variant.stockOnHand <= 0 ? 'low' : ''}`}>
                  {variant.stockOnHand.toLocaleString('en-IQ')}
                </span>
              </td>
              <td>
                <div className="ProductVariantTable-actions">
                  {onViewDetails && (
                    <button
                      className="ProductVariantTable-viewButton"
                      onClick={() => onViewDetails(variant)}
                      title={t('viewDetails') || 'View Details'}
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  {onPrintLabel && variant.barcode && (
                    <button
                      className="ProductVariantTable-labelButton"
                      onClick={() => onPrintLabel(variant)}
                      title={t('printLabel')}
                    >
                      <Tag size={16} />
                    </button>
                  )}
                  {onAction && (
                    <button className="ProductVariantTable-adjustButton" onClick={() => onAction(variant.id)}>
                      {defaultActionLabel}
                    </button>
                  )}
                  {onEdit && (
                    <button
                      className="ProductVariantTable-editButton"
                      onClick={() => onEdit(variant)}
                      title={t('edit')}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="ProductVariantTable-deleteButton"
                      onClick={() => onDelete(variant)}
                      title={t('delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductVariantTable;

