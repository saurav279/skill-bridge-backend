export type AdminListQuery = {
  page: number;
  limit: number;
  name?: string;
  email?: string;
  order: "asc" | "desc";
};

export type AdminListResponse<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
