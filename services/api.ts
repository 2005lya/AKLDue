import type {
  Due,
  RepeatUnit,
} from '@/contexts/dues-context';
import { getAccessToken } from '@/services/auth-session';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5090';


async function authorizedFetch(
  path: string,
  options: RequestInit = {}
) {
  const accessToken = await getAccessToken();

  if (accessToken === null) {
    throw new Error('Authentication is required.');
  }

  const headers = new Headers(options.headers);

  headers.set(
    'Authorization',
    `Bearer ${accessToken}`
  );

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
}

type ApiDue = {
  id: string;
  title: string;
  source: string;
  dueDate: string;
  repeatUnit: string;
  excludedDates?: string[];
  subscriptionType?: Due['subscriptionType'];
subscriptionId?: string | null;
serviceType?: string | null;
};

function isRepeatUnit(value: string): value is RepeatUnit {
  return (
  value === 'none' ||
  value === 'week' ||
  value === 'fortnight' ||
  value === 'month' ||
  value === 'quarter' ||
  value === 'year'
);
}

function mapApiDue(due: ApiDue): Due {
  return {
    id: due.id,
    title: due.title,
    source: due.source,
    dueDate: due.dueDate,
    repeatUnit: isRepeatUnit(due.repeatUnit)
      ? due.repeatUnit
      : 'none',
    excludedDates: due.excludedDates ?? [],
    subscriptionType: due.subscriptionType ?? null,
subscriptionId: due.subscriptionId ?? null,
serviceType: due.serviceType ?? null,
  };
}

export async function fetchDues(): Promise<Due[]> {
  const response = await authorizedFetch('/api/dues');

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const apiDues: ApiDue[] = await response.json();

return apiDues.map(mapApiDue);
}

export type CreateDueInput = {
  title: string;
  dueDate: string;
  repeatUnit: RepeatUnit;
};

export async function createDue(
  input: CreateDueInput
): Promise<Due> {
  const response = await authorizedFetch('/api/dues', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(input),
});

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const apiDue: ApiDue = await response.json();

  return mapApiDue(apiDue);
}

export type UpdateDueInput = {
  title: string;
  dueDate: string;
  repeatUnit: RepeatUnit;
};

export async function updateDue(
  id: string,
  input: UpdateDueInput
): Promise<Due> {
  const response = await authorizedFetch(
  `/api/dues/${encodeURIComponent(id)}`,
  {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  }
);

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const apiDue: ApiDue = await response.json();

  return mapApiDue(apiDue);
}

export async function deleteDue(id: string): Promise<void> {
  const response = await authorizedFetch(
  `/api/dues/${encodeURIComponent(id)}`,
  {
    method: 'DELETE',
  }
);

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }
}

export async function deleteDueOccurrence(
  id: string,
  date: string
): Promise<void> {
  const response = await authorizedFetch(
  `/api/dues/${encodeURIComponent(id)}` +
    `/occurrences/${encodeURIComponent(date)}`,
  {
    method: 'DELETE',
  }
);

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }
}

export type CouncilAddress = {
  id: string;
  address: string;
  propertyId: string;
};

export async function searchCouncilAddresses(
  query: string
): Promise<CouncilAddress[]> {
  const response = await authorizedFetch(
    `/api/council/addresses?query=${encodeURIComponent(query)}`
  );

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  return response.json();
}

export type CouncilService = {
  type: 'rubbish' | 'foodScraps' | 'recycling';
  title: string;
  dueDate: string;
};

export async function fetchCouncilServices(
  councilId: string
): Promise<CouncilService[]> {
  const response = await authorizedFetch(
    `/api/council/properties/` +
      `${encodeURIComponent(councilId)}/services`
  );

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  return response.json();
}

export type CouncilProperty = {
  councilAddressId: string;
  address: string;
  propertyId: string;
  ratesSubscribed: boolean;
  services: CouncilService[];
};

export type SaveCouncilPropertyInput = {
  councilAddressId: string;
  address: string;
  propertyId: string;
  serviceTypes: CouncilService['type'][];
};

export async function fetchSavedCouncilProperty():
  Promise<CouncilProperty | null> {
  const response = await authorizedFetch(
    '/api/profile/council-property'
  );

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  return response.json();
}

export async function saveCouncilProperty(
  input: SaveCouncilPropertyInput
): Promise<CouncilProperty> {
  const response = await authorizedFetch(
    '/api/profile/council-property',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  return response.json();
}

export type SaveRatesSubscriptionInput = {
  councilAddressId: string;
  address: string;
  propertyId: string;
  subscribed: boolean;
};

export async function saveRatesSubscription(
  input: SaveRatesSubscriptionInput
): Promise<{ ratesSubscribed: boolean }> {
  const response = await authorizedFetch(
    '/api/profile/council-property/rates-subscription',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `API returned ${response.status}: ${details}`
    );
  }

  return response.json();
}

export type Vehicle = {
  id: string;
  plate: string;
  regoExpiryDate: string | null;
  wofExpiryDate: string | null;
};

export type SaveVehicleInput = {
  plate: string;
  regoExpiryDate: string | null;
  wofExpiryDate: string | null;
};

export async function fetchVehicles(): Promise<Vehicle[]> {
  const response = await authorizedFetch(
    '/api/profile/vehicles'
  );

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  return response.json();
}

export async function createVehicle(
  input: SaveVehicleInput
): Promise<Vehicle> {
  const response = await authorizedFetch(
    '/api/profile/vehicles',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `API returned ${response.status}: ${details}`
    );
  }

  return response.json();
}

export async function updateVehicle(
  id: string,
  input: SaveVehicleInput
): Promise<Vehicle> {
  const response = await authorizedFetch(
    `/api/profile/vehicles/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `API returned ${response.status}: ${details}`
    );
  }

  return response.json();
}

export async function deleteVehicle(
  id: string
): Promise<void> {
  const response = await authorizedFetch(
    `/api/profile/vehicles/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }
}

export async function unsubscribeDue(
  due: Due
): Promise<void> {
  if (due.subscriptionType === null) {
    throw new Error('This due is not a subscription.');
  }

  const response = await authorizedFetch(
    '/api/profile/subscriptions/unsubscribe',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionType: due.subscriptionType,
        subscriptionId: due.subscriptionId,
        serviceType: due.serviceType,
      }),
    }
  );

  if (!response.ok) {
    const details = await response.text();

    throw new Error(
      `API returned ${response.status}: ${details}`
    );
  }
}