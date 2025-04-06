import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice: number;
  discount: number;
  image: string;
  url: string;
  merchant: string;
  rating: number;
  reviews: number;
  inStock: boolean;
  priceHistory: Array<{
    price: number;
    date: string;
  }>;
}

interface SearchState {
  query: string;
  results: Product[];
  loading: boolean;
  error: string | null;
  filters: {
    minPrice: number | null;
    maxPrice: number | null;
    merchants: string[];
    rating: number | null;
    inStock: boolean;
  };
  sortBy: "price" | "rating" | "discount" | "relevance";
  sortOrder: "asc" | "desc";
}

const initialState: SearchState = {
  query: "",
  results: [],
  loading: false,
  error: null,
  filters: {
    minPrice: null,
    maxPrice: null,
    merchants: [],
    rating: null,
    inStock: true,
  },
  sortBy: "relevance",
  sortOrder: "desc",
};

const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    setQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload;
    },
    setResults: (state, action: PayloadAction<Product[]>) => {
      state.results = action.payload;
      state.loading = false;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    setMinPrice: (state, action: PayloadAction<number | null>) => {
      state.filters.minPrice = action.payload;
    },
    setMaxPrice: (state, action: PayloadAction<number | null>) => {
      state.filters.maxPrice = action.payload;
    },
    toggleMerchant: (state, action: PayloadAction<string>) => {
      const index = state.filters.merchants.indexOf(action.payload);
      if (index === -1) {
        state.filters.merchants.push(action.payload);
      } else {
        state.filters.merchants.splice(index, 1);
      }
    },
    setRating: (state, action: PayloadAction<number | null>) => {
      state.filters.rating = action.payload;
    },
    toggleInStock: (state) => {
      state.filters.inStock = !state.filters.inStock;
    },
    setSortBy: (state, action: PayloadAction<SearchState["sortBy"]>) => {
      state.sortBy = action.payload;
    },
    setSortOrder: (state, action: PayloadAction<SearchState["sortOrder"]>) => {
      state.sortOrder = action.payload;
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
  },
});

export const {
  setQuery,
  setResults,
  setLoading,
  setError,
  setMinPrice,
  setMaxPrice,
  toggleMerchant,
  setRating,
  toggleInStock,
  setSortBy,
  setSortOrder,
  clearFilters,
} = searchSlice.actions;

export default searchSlice.reducer;
