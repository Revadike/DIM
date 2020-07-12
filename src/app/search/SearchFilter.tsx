import React, { useState, useMemo } from 'react';
import { t } from 'app/i18next-t';
import { AppIcon, tagIcon, faClone } from '../shell/icons';
import { itemTagSelectorList, isTagValue, TagValue } from '../inventory/dim-item-info';
import { connect, MapDispatchToPropsFunction } from 'react-redux';
import { RootState } from '../store/reducers';
import { setSearchQuery } from '../shell/actions';
import _ from 'lodash';
import './search-filter.scss';
import { destinyVersionSelector, currentAccountSelector } from '../accounts/reducer';
import { SearchConfig, searchFilterSelector, searchConfigSelector } from './search-filter';
import { DestinyAccount } from '../accounts/destiny-account';
import { DimItem } from '../inventory/item-types';
import { loadingTracker } from '../shell/loading-tracker';
import SearchFilterInput, { SearchFilterRef } from './SearchFilterInput';
import { showNotification } from '../notifications/notifications';
import { CompareService } from '../compare/compare.service';
import { bulkTagItems } from 'app/inventory/tag-items';
import { searchQueryVersionSelector, querySelector } from 'app/shell/reducer';
import { setItemLockState } from 'app/inventory/item-move-service';
import { storesSelector } from 'app/inventory/selectors';
import { getAllItems } from 'app/inventory/stores-helpers';
import { touch } from 'app/inventory/actions';
import { DestinyVersion } from '@destinyitemmanager/dim-api-types';
import { useLocation } from 'react-router';
import { emptyArray, emptySet } from 'app/utils/empty';
import { InventoryBuckets } from 'app/inventory/inventory-buckets';
import { DimStore } from 'app/inventory/store-types';

// these exist in comments so i18n       t('Tags.TagItems') t('Tags.ClearTag')
// doesn't delete the translations       t('Tags.LockAll') t('Tags.UnlockAll')
const bulkItemTags = Array.from(itemTagSelectorList);
bulkItemTags.push({ type: 'clear', label: 'Tags.ClearTag' });
bulkItemTags.push({ type: 'lock', label: 'Tags.LockAll' });
bulkItemTags.push({ type: 'unlock', label: 'Tags.UnlockAll' });

interface ProvidedProps {
  mobile?: boolean;
  onClear?(): void;
}

interface StoreProps {
  isPhonePortrait: boolean;
  destinyVersion: DestinyVersion;
  account?: DestinyAccount;
  searchConfig: SearchConfig;
  searchQueryVersion: number;
  searchQuery: string;
  stores: DimStore[];
  buckets?: InventoryBuckets;
  searchFilter(item: DimItem): boolean;
}

type DispatchProps = {
  setSearchQuery(query: string): void;
  bulkTagItems(items: DimItem[], tag: TagValue): void;
  touchStores(): void;
};

const mapDispatchToProps: MapDispatchToPropsFunction<DispatchProps, StoreProps> = (dispatch) => ({
  setSearchQuery: (query) => dispatch(setSearchQuery(query, true)),
  bulkTagItems: (items, tag) => dispatch(bulkTagItems(items, tag) as any),
  touchStores: touch,
});

type Props = ProvidedProps & StoreProps & DispatchProps;

function mapStateToProps(state: RootState): StoreProps {
  const searchFilter = searchFilterSelector(state);
  const stores = storesSelector(state);
  const buckets = state.inventory.buckets;

  return {
    isPhonePortrait: state.shell.isPhonePortrait,
    destinyVersion: destinyVersionSelector(state),
    account: currentAccountSelector(state),
    searchConfig: searchConfigSelector(state),
    searchFilter,
    searchQuery: querySelector(state),
    searchQueryVersion: searchQueryVersionSelector(state),
    stores,
    buckets,
  };
}

export function SearchFilter(
  {
    isPhonePortrait,
    mobile,
    searchConfig,
    setSearchQuery,
    searchQuery,
    searchQueryVersion,
    stores,
    buckets,
    searchFilter,
    touchStores,
    bulkTagItems,
    onClear,
  }: Props,
  ref: React.Ref<SearchFilterRef>
) {
  const [showSelect, setShowSelect] = useState(false);
  const location = useLocation();

  const displayableBuckets = useMemo(
    () =>
      buckets
        ? new Set(
            Object.keys(buckets.byCategory).flatMap((category) =>
              buckets.byCategory[category].map((b) => b.hash)
            )
          )
        : emptySet<number>(),
    [buckets]
  );

  // We don't have access to the selected store so we'd match multiple characters' worth.
  // Just suppress the count for now
  const onProgress = location.pathname.endsWith('progress');

  const filteredItems = useMemo(
    () =>
      !onProgress && displayableBuckets.size
        ? getAllItems(
            stores,
            (item: DimItem) => displayableBuckets.has(item.bucket.hash) && searchFilter(item)
          )
        : emptyArray<DimItem>(),
    [displayableBuckets, onProgress, searchFilter, stores]
  );

  let isComparable = false;
  if (filteredItems.length && !CompareService.dialogOpen) {
    const type = filteredItems[0].typeName;
    isComparable = filteredItems.every((i) => i.typeName === type);
  }

  const bulkTag: React.ChangeEventHandler<HTMLSelectElement> = loadingTracker.trackPromise(
    async (e) => {
      setShowSelect(false);

      const selectedTag = e.currentTarget.value;

      if (selectedTag === 'lock' || selectedTag === 'unlock') {
        // Bulk locking/unlocking

        const state = selectedTag === 'lock';
        const lockables = filteredItems.filter((i) => i.lockable);
        try {
          for (const item of lockables) {
            await setItemLockState(item, state);

            // TODO: Gotta do this differently in react land
            item.locked = state;
          }
          showNotification({
            type: 'success',
            title: state
              ? t('Filter.LockAllSuccess', { num: lockables.length })
              : t('Filter.UnlockAllSuccess', { num: lockables.length }),
          });
        } catch (e) {
          showNotification({
            type: 'error',
            title: state ? t('Filter.LockAllFailed') : t('Filter.UnlockAllFailed'),
            body: e.message,
          });
        } finally {
          // Touch the stores service to update state
          if (lockables.length) {
            touchStores();
          }
        }
      } else {
        // Bulk tagging
        const tagItems = filteredItems.filter((i) => i.taggable);

        if (isTagValue(selectedTag)) {
          bulkTagItems(tagItems, selectedTag);
        }
      }
    }
  );

  const compareMatching = () => {
    CompareService.addItemsToCompare(filteredItems, false);
  };

  const onTagClicked = () => setShowSelect(true);

  const onClearFilter = () => {
    setShowSelect(false);
    onClear?.();
  };

  // TODO: since we no longer take in the query as a prop, we can't set it from outside (filterhelp, etc)

  const placeholder = isPhonePortrait
    ? t('Header.FilterHelpBrief')
    : t('Header.FilterHelp', { example: 'is:dupe, is:maxpower, not:blue' });

  return (
    <SearchFilterInput
      ref={ref}
      onQueryChanged={setSearchQuery}
      alwaysShowClearButton={mobile}
      placeholder={placeholder}
      searchConfig={searchConfig}
      onClear={onClearFilter}
      searchQueryVersion={searchQueryVersion}
      searchQuery={searchQuery}
    >
      <>
        {!onProgress && (
          <span className="filter-match-count">
            {t('Header.FilterMatchCount', { count: filteredItems.length })}
          </span>
        )}
        {isComparable && (
          <span
            onClick={compareMatching}
            className="filter-bar-button"
            title={t('Header.CompareMatching')}
          >
            <AppIcon icon={faClone} />
          </span>
        )}

        {showSelect ? (
          <select className="bulk-tag-select filter-bar-button" onChange={bulkTag}>
            {bulkItemTags.map((tag) => (
              <option key={tag.type || 'default'} value={tag.type}>
                {t(tag.label)}
              </option>
            ))}
          </select>
        ) : (
          <span className="filter-bar-button" onClick={onTagClicked} title={t('Header.BulkTag')}>
            <AppIcon icon={tagIcon} />
          </span>
        )}
      </>
    </SearchFilterInput>
  );
}

export default connect<StoreProps, DispatchProps>(mapStateToProps, mapDispatchToProps, null, {
  forwardRef: true,
})(React.forwardRef(SearchFilter));
