"use client";

import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import FileUpload from "@/components/ui/file-upload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchCategories } from "@/lib/services/api/catalog/catalog.api";
import useCreateProductMutation from "@/lib/services/api/products/create-product.api";
import useUpdateProductMutation, {
  ProductUpdateError,
} from "@/lib/services/api/products/update-product.api";
import type { CreateProductPayload } from "@/lib/services/api/products/create-product.api";
import type { UpdateProductPayload } from "@/lib/services/api/products/update-product.api";
import type { Product } from "@/lib/types/api";
import { getProductStock } from "@/lib/utils/product";
import useToastAlert from "@/lib/hooks/use-toast-alert";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  amount: z.coerce.number().positive("Price must be positive"),
  categoryId: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  quantity: z.coerce.number().int().min(0, "Quantity cannot be negative"),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  mode?: "create" | "edit";
  product?: Product;
  onSuccess?: () => void;
  submitLabel?: string;
}

export default function ProductForm({
  mode = "create",
  product,
  onSuccess,
  submitLabel,
}: ProductFormProps) {
  const { handleSuccessToast, handleErrorToast } = useToastAlert();
  const { mutate: createProduct, isPending: isCreating } =
    useCreateProductMutation();
  const { mutate: updateProduct, isPending: isUpdating } =
    useUpdateProductMutation();
  const isPending = isCreating || isUpdating;

  const [images, setImages] = useState<string[]>(
    product?.images?.length ? product.images : [""],
  );

  // Stock moves while the form is open (orders reserve and return it), so
  // the figure shown when it was loaded is kept: stock is only sent when the
  // vendor changes it, together with this figure, and the server refuses the
  // change if orders have moved the stock since.
  const [stockBaseline, setStockBaseline] = useState(
    product ? getProductStock(product) : 0,
  );
  const [stockNotice, setStockNotice] = useState<string | null>(null);
  // This form edits a single stock figure; products with options keep stock
  // per option, so their total is shown read-only.
  const hasOptions = Boolean(
    product?.hasVariations && product.variations?.length,
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as Resolver<ProductFormValues>,
    defaultValues: {
      name: product?.name ?? "",
      amount: product?.amount ?? undefined,
      categoryId: product?.categoryId ?? "",
      description: product?.description ?? "",
      quantity: product ? getProductStock(product) : 0,
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        amount: product.amount,
        categoryId: product.categoryId,
        description: product.description ?? "",
        quantity: getProductStock(product),
      });
      setImages(product.images?.length ? product.images : [""]);
      setStockBaseline(getProductStock(product));
      setStockNotice(null);
    }
  }, [product, reset]);

  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const categoryId = watch("categoryId");

  const updateImage = (index: number, url: string) => {
    setImages((prev) => {
      const next = [...prev];
      next[index] = url;
      return next;
    });
  };

  const addImageSlot = () => {
    setImages((prev) => [...prev, ""]);
  };

  const removeImage = (index: number) => {
    setImages((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
    );
  };

  const onSubmit = (values: ProductFormValues) => {
    const uploadedImages = images.filter(Boolean);
    if (uploadedImages.length === 0) {
      handleErrorToast({ description: "Please upload at least one image." });
      return;
    }

    if (mode === "edit" && product?._id) {
      const stockChanged = !hasOptions && values.quantity !== stockBaseline;
      const payload: UpdateProductPayload = {
        name: values.name,
        amount: values.amount,
        categoryId: values.categoryId,
        description: values.description,
        images: uploadedImages,
        ...(stockChanged && {
          quantity: values.quantity,
          expectedQuantity: stockBaseline,
        }),
      };

      updateProduct(
        { id: product._id, data: payload },
        {
          onSuccess: () => {
            setStockNotice(null);
            handleSuccessToast({ description: "Product updated successfully." });
            onSuccess?.();
          },
          onError: (error: Error) => {
            const current =
              error instanceof ProductUpdateError &&
              error.code === "STOCK_CHANGED"
                ? error.conflicts[0]?.currentQuantity
                : undefined;
            if (current !== undefined) {
              // The server's message is already shown by the global error
              // toast; keep the vendor's edits and explain next to the field.
              setStockNotice(
                `Stock is now ${current} (it was ${stockBaseline} when you opened this page) because orders came in. Save again to set it to ${values.quantity}, or change the figure.`,
              );
              setStockBaseline(current);
              return;
            }
            handleErrorToast({
              description: error.message || "Failed to update product.",
            });
          },
        },
      );
      return;
    }

    const payload: CreateProductPayload = {
      name: values.name,
      amount: values.amount,
      categoryId: values.categoryId,
      description: values.description,
      quantity: values.quantity,
      images: uploadedImages,
    };

    createProduct(payload, {
      onSuccess: () => {
        handleSuccessToast({ description: "Product created successfully." });
        reset();
        setImages([""]);
        onSuccess?.();
      },
      onError: (error: Error) => {
        handleErrorToast({
          description: error.message || "Failed to create product.",
        });
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <Input
          label="Product Name"
          placeholder="Enter product name"
          className={errors.name ? "border-red-500" : ""}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Input
            label="Price (NGN)"
            type="number"
            step="0.01"
            min="0"
            placeholder="0"
            className={errors.amount ? "border-red-500" : ""}
            {...register("amount")}
          />
          {errors.amount && (
            <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
          )}
        </div>

        <div>
          <Input
            label="Quantity in stock"
            type="number"
            min="0"
            placeholder="0"
            readOnly={hasOptions}
            aria-readonly={hasOptions}
            className={`${errors.quantity ? "border-red-500" : ""} ${hasOptions ? "bg-gray-50 text-gray-500" : ""}`}
            {...register("quantity")}
          />
          {hasOptions && (
            <p className="text-gray-500 text-sm mt-1">
              Total across this product&apos;s options; stock is set per option.
            </p>
          )}
          {stockNotice && (
            <p className="text-amber-700 text-sm mt-1" role="status">
              {stockNotice}
            </p>
          )}
          {errors.quantity && (
            <p className="text-red-500 text-sm mt-1">
              {errors.quantity.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block mb-2 text-[#484848] mt-3">Category</label>
        {categoriesLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : categoriesError ? (
          <ErrorState
            title="Could not load categories"
            message="Categories are required to create a product."
            onRetry={() => refetchCategories()}
          />
        ) : (
          <>
            <Select
              value={categoryId}
              onValueChange={(value) => setValue("categoryId", value)}
            >
              <SelectTrigger className={errors.categoryId ? "border-red-500" : ""}>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category) => (
                  <SelectItem key={category._id} value={category._id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && (
              <p className="text-red-500 text-sm mt-1">
                {errors.categoryId.message}
              </p>
            )}
          </>
        )}
      </div>

      <div>
        <label className="block mb-2 text-[#484848] mt-3">Description</label>
        <textarea
          rows={4}
          placeholder="Describe your product"
          className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          {...register("description")}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Product Images
          </label>
          <Button type="button" variant="outline" size="sm" onClick={addImageSlot}>
            <Plus className="h-4 w-4 mr-1" />
            Add image
          </Button>
        </div>
        {images.map((image, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="flex-1">
              <FileUpload
                label={`Image ${index + 1}`}
                value={image}
                onChange={(url) => updateImage(index, url)}
                maxSizeMB={5}
              />
            </div>
            {images.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="mt-8 shrink-0"
                onClick={() => removeImage(index)}
                aria-label="Remove image"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Button type="submit" className="w-full md:w-auto" disabled={isPending}>
        {isPending
          ? "Saving..."
          : submitLabel ?? (mode === "edit" ? "Update product" : "Create product")}
      </Button>
    </form>
  );
}
