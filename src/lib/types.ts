export type UserRole =
  | 'resident'
  | 'commercial_establishment'
  | 'contractor'
  | 'recycling_partner'
  | 'facility_operator'
  | 'district_engineer'
  | 'engineer'
  | 'supervisor'
  | 'driver'
  | 'admin'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  district: string
  address: string
  organisation_name?: string
  phone?: string
  created_at: string
  is_approved: boolean
}

export const DISTRICTS = [
  'Colombo 1 - Fort/Pettah',
  'Colombo 2 - Slave Island',
  'Colombo 3 - Kollupitiya',
  'Colombo 4 - Bambalapitiya',
  'Colombo 5 - Havelock Town',
  'Colombo 6 - Wellawatte',
  'Colombo 7 - Cinnamon Gardens',
  'Colombo 8 - Borella',
  'Colombo 9 - Dematagoda',
  'Colombo 10 - Maradana',
  'Colombo 11 - Pettah',
  'Colombo 12 - Hulftsdorp',
  'Colombo 13 - Kotahena',
  'Colombo 14 - Grandpass',
  'Colombo 15 - Mattakkuliya',
]

export const ROLE_LABELS: Record<UserRole, string> = {
  resident: 'Resident',
  commercial_establishment: 'Commercial Establishment',
  contractor: 'Waste Collection Contractor',
  recycling_partner: 'Recycling Partner',
  facility_operator: 'Waste Facility Operator',
  district_engineer: 'District Engineer',
  engineer: 'Municipal Engineer',
  supervisor: 'Field Supervisor',
  driver: 'Collection Vehicle Driver',
  admin: 'System Administrator',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  resident: 'Manage your household waste collection and report issues',
  commercial_establishment: 'Manage commercial waste services and billing',
  contractor: 'Oversee collection vehicles, drivers and routes',
  recycling_partner: 'Record and manage recyclable material deliveries',
  facility_operator: 'Manage waste intake at processing facilities',
  district_engineer: 'Oversee waste operations across your district',
  engineer: 'Monitor and manage municipal waste operations',
  supervisor: 'Supervise collection routes and field staff',
  driver: 'View assigned routes and confirm collections',
  admin: 'Full system access and user management',
}

export const ROLE_ICONS: Record<UserRole, string> = {
  resident: '🏠',
  commercial_establishment: '🏢',
  contractor: '🚛',
  recycling_partner: '♻️',
  facility_operator: '🏭',
  district_engineer: '👷',
  engineer: '⚙️',
  supervisor: '📋',
  driver: '🚗',
  admin: '🛡️',
}

export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  resident: '/dashboard/resident',
  commercial_establishment: '/dashboard/commercial',
  contractor: '/dashboard/contractor',
  recycling_partner: '/dashboard/recycler',
  facility_operator: '/dashboard/facility',
  district_engineer: '/dashboard/district-engineer',
  engineer: '/dashboard/engineer',
  supervisor: '/dashboard/supervisor',
  driver: '/dashboard/driver',
  admin: '/dashboard/admin',
}

export const PUBLIC_ROLES: UserRole[] = [
  'resident',
  'commercial_establishment',
]

export const ADMIN_CREATED_ROLES: UserRole[] = [
  'contractor',
  'recycling_partner',
  'facility_operator',
  'district_engineer',
  'engineer',
  'supervisor',
  'driver',
]