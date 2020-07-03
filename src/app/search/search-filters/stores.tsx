import { DimItem } from 'app/inventory/item-types';
import { FilterDefinition } from '../filter-types';

import { DestinyClass } from 'bungie-api-ts/destiny2';
import { DimStore } from 'app/inventory/store-types';
import { getStore } from 'app/inventory/stores-helpers';

const stores: DimStore[] = [];
const currentStore: DimStore = {} as DimStore;

// filters that check stores
const locationFilters: FilterDefinition[] = [
  {
    keywords: 'location',
    hint: 'location',
    description: 'location',
    format: 'attribute',
    destinyVersion: 0,
    filterFunction: (item: DimItem, filterValue: string) => {
      let storeIndex = 0;

      switch (filterValue) {
        case 'inleftchar':
          storeIndex = 0;
          break;
        case 'inmiddlechar':
          if (stores.length === 4) {
            storeIndex = 1;
          }
          break;
        case 'inrightchar':
          if (stores.length > 2) {
            storeIndex = stores.length - 2;
          }
          break;
        default:
          return false;
      }

      return item.bucket.accountWide && !item.location.inPostmaster
        ? item.owner !== 'vault'
        : item.owner === stores[storeIndex].id;
    },
  },
  {
    keywords: 'onwrongclass',
    hint: 'onwrongclass',
    description: 'onwrongclass',
    format: 'attribute',
    destinyVersion: 0,
    filterFunction: (item: DimItem) => {
      const ownerStore = getStore(stores, item.owner);

      return (
        !item.classified &&
        item.owner !== 'vault' &&
        !item.bucket.accountWide &&
        item.classType !== DestinyClass.Unknown &&
        ownerStore &&
        !item.canBeEquippedBy(ownerStore) &&
        !item.location?.inPostmaster
      );
    },
  },
  {
    keywords: 'owner',
    hint: 'owner',
    description: 'owner',
    format: 'attribute',
    destinyVersion: 0,
    filterFunction: (item: DimItem, filterValue: string) => {
      let desiredStore = '';
      switch (filterValue) {
        case 'invault':
          desiredStore = 'vault';
          break;
        case 'incurrentchar': {
          if (currentStore) {
            desiredStore = currentStore.id;
          } else {
            return false;
          }
        }
      }
      return item.owner === desiredStore;
    },
  },
];

export default locationFilters;
