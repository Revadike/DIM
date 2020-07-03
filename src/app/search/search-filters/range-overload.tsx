import { D2Item } from 'app/inventory/item-types';
import _ from 'lodash';
import * as hashes from '../search-filter-values';
import * as D2Values from '../d2-known-values';
import { FilterDefinition } from '../filter-types';
import { rangeStringToComparator } from './range-numeric';
import seasonTags from 'data/d2/season-tags.json';
import { getItemPowerCapFinalSeason } from 'app/utils/item-utils';

/** matches a filterValue that's probably a math check */
const mathCheck = /^[\d<>=]/;

// overloadedRangeFilters: stuff that may test a range, but also accepts a word

// this word might become a number like arrival ====> 11,
// then be processed normally in a number check

// or the word might be checked differently than the number, like
// masterwork:handling is a completely different test from masterwork:>7
const overloadedRangeFilters: FilterDefinition[] = [
  {
    keywords: 'masterwork',
    hint: "item's masterwork level or stat",
    description: "filter by item's masterwork level or stat",
    format: 'rangeoverload',
    destinyVersion: 2,
    filterValuePreprocessor: (filterValue: string) => {
      if (mathCheck.test(filterValue)) {
        const numberComparisonFunction = rangeStringToComparator(filterValue);
        return (item: D2Item) =>
          Boolean(
            item.masterworkInfo?.tier &&
              numberComparisonFunction(Math.min(item.masterworkInfo.tier, 10))
          );
      }
      const searchedMasterworkStatHash = hashes.statHashByName[filterValue];
      return (item: D2Item) =>
        Boolean(
          searchedMasterworkStatHash &&
            item.masterworkInfo?.statHash &&
            searchedMasterworkStatHash === item.masterworkInfo.statHash
        );
    },
  },
  {
    keywords: 'energycapacity',
    hint: "item's energy level or element",
    description: "filter by item's energy level or element",
    format: 'rangeoverload',
    destinyVersion: 2,
    filterValuePreprocessor: (filterValue: string) => {
      if (mathCheck.test(filterValue)) {
        const numberComparisonFunction = rangeStringToComparator(filterValue);
        return (item: D2Item) =>
          item.energy && numberComparisonFunction(item.energy.energyCapacity);
      }
      return (item: D2Item) =>
        item.energy && filterValue === D2Values.energyNamesByEnum[item.energy.energyType];
    },
  },
  {
    keywords: 'season',
    hint: "item's season",
    description: "filter by item's season of origin",
    format: 'range',
    destinyVersion: 2,
    filterValuePreprocessor: seasonRangeStringToComparator,
    filterFunction: (item: D2Item, filterValue: (compare: number) => boolean) =>
      filterValue(item.season),
  },
  {
    keywords: 'sunsetsafter',
    hint: "item's power limit",
    description: "filter by item's power limit",
    format: 'range',
    destinyVersion: 2,
    filterValuePreprocessor: seasonRangeStringToComparator,
    filterFunction: (item: D2Item, filterValue: (compare: number) => boolean) => {
      const itemFinalSeason = getItemPowerCapFinalSeason(item);
      return filterValue(itemFinalSeason ?? 0);
    },
  },
];

export default overloadedRangeFilters;

/**
 * replaces a word with a corresponding season
 *
 * i.e. turns `<=forge` into `<=5`
 *
 * use only on simple filter values where there's not other letters
 */
function replaceSeasonTagWithNumber(s: string) {
  return s.replace(/[a-z]+$/i, (tag) => seasonTags[tag]);
}

/**
 * replaces a possible season keyword with its number, then returns usual math comparator
 */
function seasonRangeStringToComparator(rangeString: string) {
  return rangeStringToComparator(replaceSeasonTagWithNumber(rangeString));
}
