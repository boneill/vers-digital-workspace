/*!
 * Copyright © 2005-2024 Hyland Software, Inc. and its affiliates. All rights reserved.
 *
 * Alfresco Example Content Application
 *
 * This file is part of the Alfresco Example Content Application.
 * If the software was purchased under a paid Alfresco license, the terms of
 * the paid license agreement will prevail. Otherwise, the software is
 * provided under the following open source license terms:
 *
 * The Alfresco Example Content Application is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * The Alfresco Example Content Application is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * from Hyland Software. If not, see <http://www.gnu.org/licenses/>.
 */

import { Injectable } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { map, take } from 'rxjs/operators';

import { CREATE_TRANSFER_ACTION, CREATE_VEO_ACTION, CreateTransferAction, CreateVEOAction } from '../actions/vers.actions';
import { VersService } from '../services/vers.service';
import { Store } from '@ngrx/store';
import { AppStore, getAppSelection } from '@alfresco/aca-shared/store';


@Injectable()
export class VersEffects {



  constructor(
    private actions$: Actions,
    private versService: VersService,
    private store: Store<AppStore>) {}

  createTransfer$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<CreateTransferAction>(CREATE_TRANSFER_ACTION),
        map((action) => {
          if(action){
            console.log("Called Create transfer effect");
            this.versService.createTransferFolder();
          }
        })
      ),
    { dispatch: false }
  );

  createVeo$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<CreateVEOAction>(CREATE_VEO_ACTION),
        map((action) => {
           if (action.payload) {
              this.versService.queueVeosForCreation([{entry: action.payload}]);
            } else {
              this.store
                .select(getAppSelection)
                .pipe(take(1))
                .subscribe((selection) => {
                  if (selection && !selection.isEmpty) {

                    //this.brokingContentManagementService.moveNode(selection.first);

                    this.versService.queueVeosForCreation(
                        selection.nodes);
                    //this.contentService.moveNodes(selection.nodes);
                  }
                });
            }
        })
      ),
    { dispatch: false }
  );

}
