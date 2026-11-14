import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types/api";
import {
  getProductCategoryName,
  getProductImage,
  getProductPrice,
  getProductStock,
} from "@/lib/utils/product";
import { formatNaira } from "@/lib/utils/format-price";

interface ProductCardProps {
  product: Product;
  onDelete?: (id: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onDelete }) => {
  const imageUrl = getProductImage(product);
  const stock = getProductStock(product);
  const price = getProductPrice(product);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative h-48 w-full bg-gray-200">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-400">No image</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1">
          {product.name}
        </h3>

        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
          {product.description || "No description"}
        </p>

        <div className="flex justify-between items-center mb-3">
          <span className="text-xl font-bold text-primary">
            {formatNaira(price)}
          </span>
          <span
            className={`text-sm px-2 py-1 rounded ${
              stock > 0
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {stock > 0 ? `${stock} in stock` : "Out of stock"}
          </span>
        </div>

        <div className="text-xs text-gray-500 mb-3">
          Category: {getProductCategoryName(product)}
        </div>

        <div className="flex gap-2">
          <Link
            href={`/dashboard/products/${product._id}`}
            className="flex-1 px-3 py-2 text-sm text-center bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Edit
          </Link>
          {onDelete && (
            <button
              onClick={() => onDelete(product._id)}
              className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
