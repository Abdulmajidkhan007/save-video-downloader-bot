import { QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      onError: (error: any) => {
        const message = error?.response?.data?.message || 'Xatolik yuz berdi';
        toast.error(message);
      },
    },
  },
});
