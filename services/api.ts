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

  if (response.ok) {
    return response.json();
  }

  if (response.status === 503) {
    return fetchCouncilServicesFromCouncil(councilId);
  }

    throw new Error(`API returned ${response.status}`);
}

async function fetchCouncilServicesFromCouncil(
  councilId: string
): Promise<CouncilService[]> {
  const response = await fetch(
    'https://www.aucklandcouncil.govt.nz/en/' +
      'rubbish-recycling/rubbish-recycling-collections/' +
      'rubbish-recycling-collection-days/' +
      `${encodeURIComponent(councilId)}.html`,
    {
      headers: {
        Accept:
          'text/html,application/xhtml+xml,' +
          'application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-NZ,en;q=0.9,en-US;q=0.8',
        'Cache-Control': 'max-age=0',
        'Sec-CH-UA':
          '"Chromium";v="135", "Not.A/Brand";v="8"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/135.0.0.0 Safari/537.36',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Council returned ${response.status}`);
  }

  return parseCouncilServices(await response.text());
}

function parseCouncilServices(html: string): CouncilService[] {
  const services: CouncilService[] = [];

  const serviceLabels = [
    {
      type: 'rubbish',
      title: 'Rubbish',
    },
    {
      type: 'foodScraps',
      title: 'Food scraps',
    },
    {
      type: 'recycling',
      title: 'Recycling',
    },
  ] as const;

  for (const service of serviceLabels) {
    const match = html.match(
      new RegExp(
        `${service.title}:[\\s\\S]{0,500}?` +
          `children\\\\?":\\\\?"` +
          `([A-Za-z]+, \\d{1,2} [A-Za-z]+)`,
        'i'
      )
    );

    if (match?.[1]) {
      services.push({
        type: service.type,
        title: service.title,
        dueDate: formatCouncilDate(match[1]),
      });
    }
  }

  if (services.length === 0) {
    throw new Error('No collection services were found.');
  }

  return services;
}

function formatCouncilDate(value: string): string {
  const [, dayText, monthText] =
    value.match(/^[A-Za-z]+, (\d{1,2}) ([A-Za-z]+)$/) ?? [];

  if (!dayText || !monthText) {
    throw new Error(`Unknown Council date: ${value}`);
  }

  const months = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];

  const month = months.indexOf(monthText.toLowerCase());

  if (month < 0) {
    throw new Error(`Unknown Council month: ${monthText}`);
  }

  const today = new Date();
  const date = new Date(
    today.getFullYear(),
    month,
    Number(dayText)
  );

  if (date < new Date(today.toDateString())) {
    date.setFullYear(date.getFullYear() + 1);
  }

  const year = date.getFullYear();
  const monthNumber = String(date.getMonth() + 1).padStart(2, '0');
  const dayNumber = String(date.getDate()).padStart(2, '0');

  return `${year}-${monthNumber}-${dayNumber}`;
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
  services?: CouncilService[];
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
