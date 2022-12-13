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
import {
  Component,
  OnInit,
  ViewChild,
  Output,
  EventEmitter,
} from '@angular/core';
import {
  FileType,
  UploadComponent,
} from 'src/app/shared/upload/upload.component';

@Component({
  selector: 'app-upload-html',
  templateUrl: './upload-html.component.html',
  styleUrls: ['./upload-html.component.css'],
})
export class UploadHtmlComponent implements OnInit {
  isValid: boolean = false;
  fileTypes: FileType = FileType.HTML;

  @ViewChild('uploadHtml') upload: UploadComponent;
  @Output() isChildFormValid: EventEmitter<boolean> = new EventEmitter<
    boolean
  >();

  constructor() {}

  ngOnInit(): void {}

  uploadToServer() {
    this.upload.uploadToServer();
  }

  updateIsValid(validEvent) {
    this.isValid = validEvent;
    this.isChildFormValid.emit(validEvent);
  }
}
