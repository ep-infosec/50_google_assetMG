/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/catch';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Asset,
  TextAsset,
  AssetAdGroups,
  AssetConnType,
  AssetType,
  MutateRecord,
} from './../model/asset';
import { UpdateResponse, STATUS } from '../model/response';
import { Account, AccountAGs } from './../model/account';
import { AuthorizationService } from '../services/authorization.service'

@Injectable({
  providedIn: 'root',
})
export class AssetService {
  private API_SERVER = location.origin;

  /** Gets updated when the account changes */
  private _activeAccountId$ = new BehaviorSubject<number>(null);
  private _activeAccount$ = new BehaviorSubject<Account>(null);
  private _accountAGs$ = new BehaviorSubject<AccountAGs>(null);
  private _allAssets$ = new BehaviorSubject<Asset[]>(null);
  private _assetsToAdGroups: Asset[] = [];

  /** Gets updated when an asset is selected */
  private _activeAsset$ = new BehaviorSubject<Asset>(null);
  private _activeAssetAdGroups$ = new BehaviorSubject<AssetAdGroups>(null);

  /** Gets updated when the update Asset is called */
  private _updateFinished$ = new BehaviorSubject<UpdateResponse>(null);

  allAssets$ = this._allAssets$.asObservable();
  activeAccount$ = this._activeAccount$.asObservable();
  activeAccountId$ = this._activeAccountId$.asObservable();
  accountAGs$ = this._accountAGs$.asObservable();
  activeAsset$ = this._activeAsset$.asObservable();
  activeAssetAdGroups$ = this._activeAssetAdGroups$.asObservable();
  updateFinished$ = this._updateFinished$.asObservable();

  constructor(
    private _http: HttpClient,
    private _authService: AuthorizationService
    ) {}

  private getAllAssets(accountId: number) {
    // Reset the asset observable till the http request is made
    this._allAssets$.next(null);
    // Call the API and update the asset observable
    const endpoint = this.API_SERVER + '/accounts-assets/';
    let subscription = this._http
      .get<Asset[]>(endpoint, { params: { cid: accountId?.toString() } })
      .subscribe((assets) => {
        this._allAssets$.next(assets);
        subscription.unsubscribe();
      });
  }


  private getAccountAdGroups(accountId: number) {
    const endpoint = this.API_SERVER + '/account-ag-struct';
    let subscription = this._http
      .get<AccountAGs>(endpoint, { params: { cid: accountId?.toString() } })
      .subscribe((accountAGs) => {
        this._accountAGs$.next(accountAGs);
        subscription.unsubscribe();
      });
  }

  /** Loads a specific asset to adgroups mapping */
  private getAssetsToAdGroups(asset_id, asset_type) {
    let accountId
    this.activeAccountId$.subscribe((id) =>{
      accountId = id;
    })
    const endpoint = this.API_SERVER + '/assets-to-ag/';
    let subscription = this._http.get<Asset[]>(endpoint,
       { params: { 
         asset_id: asset_id,
         asset_type: asset_type,
         customer_id: JSON.stringify(accountId)
         } 
       })
    .subscribe((assets) => {
      this._assetsToAdGroups = assets;
      this._activeAssetAdGroups$.next(this.getActiveAssetAdGroups(asset_id));
      subscription.unsubscribe();
    });
  }

  getAccountIds(): Observable<Account[]> {
    const endpoint = this.API_SERVER + '/accounts/';
    return this._http.get<Account[]>(endpoint);
  }

  changeAsset(asset: Asset) {
    this._activeAsset$.next(asset);
    if (asset) {
      this.getAssetsToAdGroups(asset.id, asset.type)
    } else {
      this._activeAssetAdGroups$.next(null);
    }
  }

  unselectAsset() {
    this.changeAsset(null);
  }

  changeAccount(accountId: number) {
    this._activeAccountId$.next(accountId);
    this.getAllAssets(accountId);
    this.getAccountAdGroups(accountId);
    this.changeAsset(null);
  }

  getActiveAssetAdGroups(assetId: number) {
    let assetAdGroups: AssetAdGroups = new Map();
    this._assetsToAdGroups.filter(function (asset) {
      if (asset.id == assetId) {
        let AssetConnection = AssetConnType.ADGROUP;
        if (asset.type == AssetType.TEXT) {
          (asset as TextAsset).text_type.toLowerCase() ==
          AssetConnType.HEADLINE.toLowerCase()
            ? (AssetConnection = AssetConnType.HEADLINE)
            : (AssetConnection = AssetConnType.DESC);
        }
        assetAdGroups.set(AssetConnection, asset.adgroups);
      }
    });
    return assetAdGroups;
  }

  updateAsset(changedAsset: Asset, updateArray: MutateRecord[]) {
    const endpoint = this.API_SERVER + '/mutate-ad/';
    var refresh_token = this._authService.getRefreshToken()
    var load = {'refresh_token':refresh_token, 'data':updateArray}
    let subscription = this._http
      .post(endpoint, load, { observe: 'response' })
      .subscribe(
        (response) => {
          // update the asset to adgroup cache
          let updatedAssets = (<any[]>response.body)[0].asset;
          this._assetsToAdGroups = updatedAssets;
          // Update the new selection
          this._activeAssetAdGroups$.next(
            this.getActiveAssetAdGroups(changedAsset.id)
          );
          // Updated the caller that the API is done
          let msg = '';
          if (response.status === STATUS.PARTIAL_SUCCESS) {
            let failures =
              (<any[]>response.body)[0].failures ||
              (<any>response.body).failures;
            if (failures) {
              for (let failure of failures) {
                msg += `Update failed for the ad group "${failure.adgroup.adgroup_name}" of campaign "${failure.adgroup.campaign_name}":
                    ${failure.error_message}<br/>`;
              }
            } else {
              msg = 'Update failed for some ad groups.';
            }
          }
          this._updateFinished$.next({
            status_code: response.status,
            msg: msg,
            assets: updatedAssets,
          });
          subscription.unsubscribe();
        },
        (error) => {
          // API call failed - Returned status 500
          let errorMessage = '';
          let failures = error.error[0]?.failures || error.error?.failures;
          if (failures) {
            for (let failure of failures) {
              errorMessage += `Update failed for the ad group "${failure.adgroup.adgroup_name}" from campaign "${failure.adgroup.campaign_name}": 
              ${failure.error_message}<br/>`;
            }
          } else {
            errorMessage = `Error Code: ${error.status}<br/>Message: ${error.message}`;
          }

          this._updateFinished$.next({
            status_code: STATUS.FAIL,
            msg: errorMessage,
            assets: [],
          });
          subscription.unsubscribe();
        }
      );
  }

  addNewAsset(asset: Asset) {
    // Update all assets with the newly uploaded asset
    if (asset) {
      console.log('Asset: ', asset);
      let waitTime = 0;
      if (asset.type == AssetType.IMG) {
        waitTime = 12000;
      }
      this._assetsToAdGroups.push(asset);
      // This is a workaround to overcome the server not detecting the image
      // type and loading it - so we give it some time.
      setTimeout(() => {
        this._allAssets$.next(this._allAssets$.getValue().concat(asset));
      }, waitTime);
    }
  }
}
