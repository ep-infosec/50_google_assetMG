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
import { AssetType } from '../model/asset';
import { YouTubeVid } from '../model/yt-vid'
import { BehaviorSubject } from 'rxjs';
import { AuthorizationService } from './authorization.service';

@Injectable({
  providedIn: 'root',
})
export class UploadAssetService {
  private API_SERVER = location.origin;

  private _YtVidList$ = new BehaviorSubject<YouTubeVid[]>(null);
  ytVidList$ = this._YtVidList$.asObservable();  

  constructor(
    private http: HttpClient,
    private _authorizationService: AuthorizationService
  ) {}

  /** Used for text assets only */
  addTextAsset(
    account: number,
    text: string,
    assetType: AssetType,
    adGroups: number[]
  ) {
    const endpoint = this.API_SERVER + '/upload-asset/';

    var refreshToken = this._authorizationService.getRefreshToken();
    let textAsset = {
      account: account,
      refresh_token: refreshToken,
      asset_type: assetType,
      asset_name: '',
      asset_text: text,
      adgroups: adGroups,
    };

    return this.http.post(endpoint, textAsset, { observe: 'response' });
  }

  /** Used for all non-text assets */
  uploadAsset(
    account: number,
    assetName: string,
    assetType: AssetType,
    adGroups: number[],
    url?: string
  ) {
    let asset;
    const endpoint = this.API_SERVER + '/upload-asset/';

    var refreshToken = this._authorizationService.getRefreshToken();
    if (assetType === AssetType.VIDEO) {
      asset = {
        account: account,
        refresh_token: refreshToken,
        asset_type: assetType,
        asset_name: assetName,
        url: url,
        adgroups: adGroups,
      };
    } else {
      asset = {
        account: account,
        refresh_token: refreshToken,
        asset_type: assetType,
        asset_name: assetName,
        adgroups: adGroups,
      };
    }

    return this.http.post(endpoint, asset, { observe: 'response' });
  }

  validateDimensions(
    width: number,
    height: number
  ){
    let image = {
      width: width,
      height: height
    }
    const endpoint = this.API_SERVER + '/validate-dimensions/'

    return this.http.post(endpoint, image,{ observe: 'response'})
  }


  clearUploads() {
    const endpoint = this.API_SERVER + '/clean-dir/';
    let subscritpion = this.http.get(endpoint).subscribe((_) => {
      subscritpion.unsubscribe();
    });
  }

  loadYtChannelVideos(){
    var endpoint = this.API_SERVER + '/get-yt-videos/';
    let subscription = this.http.get<YouTubeVid[]>(endpoint)
    .subscribe((vids) =>{
      this._YtVidList$.next(vids);
      subscription.unsubscribe();
    })
  }

  bulkUploadToYt(uploadList){
    const endpoint = this.API_SERVER + '/upload-asset-bulk/';
    var refresh_token = this._authorizationService.getRefreshToken();
    var payload = {'refresh_token': refresh_token, 'data': uploadList}
    return this.http.post(endpoint, payload, {observe: 'response'})
  }
}
