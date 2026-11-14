import { Pagination } from "../interfaces/pagination.interface";

export type PromisifiedPagination<T> = Promise<Pagination<T>>;
