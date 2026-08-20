export type AdminListQuery = {
  page: number;
  limit: number;
  name?: string;
  email?: string;
  order: "asc" | "desc";
  packageName?: string;
  from?: string;
  to?: string;
};

export type AdminListResponse<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
