/**
 * Optional React Query hooks. Only imported if the consumer uses React.
 */
import { useEffect, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import {
  type ApiClient,
  type CreateJobRequest,
  type Job,
  type JobEvent,
  type ProbeResult,
  subscribeJobEvents,
  type ApiClientOptions,
} from './index';

const keys = {
  health: ['ud', 'health'] as const,
  sites: ['ud', 'sites'] as const,
  jobs: (status?: string) => ['ud', 'jobs', status ?? 'all'] as const,
  job: (id: string) => ['ud', 'job', id] as const,
};

export function useHealth(client: ApiClient, options?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: keys.health,
    queryFn: async () => {
      const { data, error } = await client.GET('/health');
      if (error) throw error;
      return data;
    },
    ...(options as object),
  });
}

export function useSites(client: ApiClient) {
  return useQuery({
    queryKey: keys.sites,
    queryFn: async () => {
      const { data, error } = await client.GET('/sites');
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useProbe(client: ApiClient) {
  return useMutation({
    mutationFn: async (url: string): Promise<ProbeResult> => {
      const { data, error } = await client.POST('/probe', { body: { url } });
      if (error) throw error;
      return data!;
    },
  });
}

export function useJobs(client: ApiClient, status?: Job['status']) {
  return useQuery({
    queryKey: keys.jobs(status),
    queryFn: async () => {
      const { data, error } = await client.GET('/jobs', {
        params: { query: status ? { status } : {} },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useJob(client: ApiClient, id: string | undefined) {
  return useQuery({
    queryKey: keys.job(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await client.GET('/jobs/{id}', {
        params: { path: { id: id! } },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateJob(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: CreateJobRequest): Promise<Job> => {
      const { data, error } = await client.POST('/jobs', { body: req });
      if (error) throw error;
      return data!;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ud', 'jobs'] });
    },
  });
}

export function useDeleteJob(client: ApiClient) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.DELETE('/jobs/{id}', {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ud', 'jobs'] });
    },
  });
}

/**
 * Live SSE subscription for one job. Returns the latest event and a derived
 * progress %. Component re-renders on every event.
 */
export function useJobEvents(opts: ApiClientOptions, jobId: string | undefined) {
  const [event, setEvent] = useState<JobEvent | null>(null);
  useEffect(() => {
    if (!jobId) return;
    setEvent(null);
    return subscribeJobEvents(opts, jobId, setEvent);
  }, [jobId, opts.baseUrl, opts.apiKey]);
  return event;
}
