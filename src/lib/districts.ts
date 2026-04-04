export const DISTRICT_WARD_MAP: Record<string, string[]> = {
    'Colombo North - District 1': [
        'Mattakkuliya', 'Modera', 'Mahawatte', 'Aluthmawatha',
        'Lunupokuna', 'Bloemendhal', 'Kotahena East', 'Kotahena West',
    ],
    'Colombo Central 1 - District 2A': [
        'Kochchikade North', 'Gintupitiya', 'Masangasweediya', 'New Bazaar',
        'Grandpass North', 'Grandpass South', 'Aluthkade East', 'Aluthkade West',
        'Kehelwatte', 'Kochchikade South', 'Fort',
    ],
    'Colombo Central 2 - District 2B': [
        'Maligawatte West', 'Kompannaweediya', 'Wekanda', 'Hunupitiya',
        'Suduwella', 'Panchikawatte', 'Maligakande', 'Maligawatte East', 'Kollupitiya',
    ],
    'Borella - District 3': [
        'Dematagoda', 'Wanathamulla', 'Kuppiyawatte East', 'Kuppiyawatte West',
        'Borella North', 'Borella South', 'Cinnamon Garden',
    ],
    'Colombo East - District 4': [
        'Narahenpita', 'Thimbirigasyaya', 'Kirula', 'Kirillapone', 'Pamankade East',
    ],
    'Colombo West - District 5': [
        'Bambalapitiya', 'Milagiriya', 'Havelock Town',
        'Wellawatte North', 'Pamankade West', 'Wellawatte South',
    ],
}

export const CMC_DISTRICTS = Object.keys(DISTRICT_WARD_MAP)

// Get all wards as flat list with district info
export const ALL_WARDS = Object.entries(DISTRICT_WARD_MAP).flatMap(
    ([district, wards]) => wards.map(ward => ({ ward, district }))
)

// Get district from ward
export function getDistrictFromWard(ward: string): string {
    for (const [district, wards] of Object.entries(DISTRICT_WARD_MAP)) {
        if (wards.includes(ward)) return district
    }
    return ''
}

// Get wards for a district
export function getWardsForDistrict(district: string): string[] {
    return DISTRICT_WARD_MAP[district] || []
}