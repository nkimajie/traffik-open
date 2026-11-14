export interface ICategory {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  parent?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubcategory {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  categoryId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Single category from GET /categories/:id including its active subcategories. */
export interface ICategoryDetail extends ICategory {
  subcategories: ISubcategory[];
}
