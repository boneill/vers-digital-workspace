import { Component, DestroyRef, inject, Input, OnInit } from '@angular/core';
import { Node, NodeAssociationEntry } from '@alfresco/js-api';
import { VersService } from '../../services/vers.service';
import { CardViewDatetimeItemModel, CardViewItem, CardViewTextItemModel, CardViewComponent } from '@alfresco/adf-core';
import { MatCard, MatCardActions } from "@angular/material/card";
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { AppStore, ViewNodeAction } from '@alfresco/aca-shared/store';
import { MatDividerModule } from "@angular/material/divider";
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, Observable, of, take } from 'rxjs';
//import { MatIcon } from "@angular/material/icon";


@Component({
  selector: 'veo-details-tab',
  template: `
    <mat-card style="border: 1px solid #ccc; padding: 12px; border-radius: 4px;" *ngIf="veoNode">
      <adf-card-view [properties]="veoNodeDisplayProperties" [editable]="false"
      style="display:block; border:1px solid #ddd; padding:12px; border-radius:4px;">
    </adf-card-view>

    <!-- Divider line (optional) -->
  <mat-divider></mat-divider>

  <mat-card-actions *ngIf="veoCreationFailed" align="start">
    <button mat-button color="primary"
      class="adf-action-button"
      disableRipple (click)="regenerateVeo()"
      style="
          padding: 0;
          min-width: 0;
          background: none;
          box-shadow: none;
          border: none;
          cursor: pointer;
          color: #1976d2;
          text-decoration: underline;
        ">
      Regenerate VEO
    </button>
  </mat-card-actions>

    </mat-card>
  `,
  imports: [ CommonModule, MatCard, CardViewComponent, MatDividerModule, MatCardActions ]
})
export class VeoInformationTabComponent implements OnInit{
  @Input()
  node!: Node;

  isVeo: boolean = false;


  private readonly destroyRef = inject(DestroyRef);

  showVeoAssociation: boolean = false;
  veoCreationFailed: boolean = false;

  veoNode?: Node;
  veoNodeDisplayProperties: CardViewItem[] = []; // [{label: 'My Label', value: 'My value'}

  protected store = inject<Store<AppStore>>(Store<AppStore>);

  constructor( private versService: VersService, private router: Router ) {
  }

  ngOnInit(): void {
  // Evaluate show flag safely
  this.showVeoAssociation = this.node?.properties?.["vers:veoStatus"] ?? false;

  if (this.showVeoAssociation) {

  // if its a record then get the veo node from the vers service
  // if its already a veo then we already have a veo.
  // we need the veoNodeWrapper so the observable is of a known (Node)
  // type for the pipe.  It might be easier to just cast the return
  // of getVeoNodeFromRecord to a Node.

  type VeoNodeWrapper = { entry: Node | NodeAssociationEntry | undefined };
  this.isVeo = this.node?.nodeType === 'vers:veo';
  const veoNode$ : Observable<VeoNodeWrapper> =  this.isVeo? of({ entry: this.node })
    : this.versService.getVeoNodeFromRecord(this.node).pipe(
      take(1),
      map(result => ({ entry: result?.entry })) // wrap the result to match the "entry" shape
      );


//this.versService.getVeoNodeFromRecord(this.node)
      veoNode$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(veoNode => {
        //this.veoNode = veoNode ? veoNode.entry : undefined;
        this.veoNode = veoNode?.entry as Node?? undefined;

        if(this.veoNode){

          this.veoCreationFailed = this.veoNode?.properties['vers:veoStatus'] == "failed"? true: false;

          // Change the name and label based on whether the
          // original selection is a veo node or a record.
          // If the selected node is a veo, show the record name and label.
          // If the selected node is a record show the veo name and label.
          console.log("isVeo", this.isVeo);

          let nameValue = this.isVeo? this.veoNode.properties["vers:linkedRecordName"]: this.veoNode.name;
          let nameLabel = this.isVeo? "Record Name":"VEO Name";
          // let nameValue = this.isVeo? this.veoNode.name : this.node.name;
          // if(this.isVeo){
          //   // show the Record Name
          //   nameLabel = "Record Name";
          //   nameValue = this.node.name;

          // }

        console.log("Name Value", nameValue);

         this.veoNodeDisplayProperties = [
          new CardViewTextItemModel({
              label: nameLabel,
              value: nameValue,
              key: 'name',
              //default: 'default bar' ,
              multiline: false,
              clickCallBack : ()=>{ this.onNameClick()},
              clickable: true
            }),
          new CardViewTextItemModel({
              label: 'VEO Creation Status',
              value: this.veoNode?.properties['vers:veoStatus'],
              key: 'veo-status',
              //default: 'default bar' ,
              multiline: false
              //clickCallBack : ()=>{ myClickImplementation()}
          }),
          new CardViewDatetimeItemModel({
            label: 'VEO Modified Date',
            value: this.veoNode?.properties['vers:veoGeneratedDate'],
            key: 'veo-generated-date',
            //default: new Date(),
            //format: '<any format that momentjs accepts>',
            //editable: true
          }),
          new CardViewTextItemModel({
            label: 'Consignment Id',
            value: this.veoNode?.properties['vers:consignmentId'],
            key: 'veo-consignment-id',
            //default: 'default bar' ,
            multiline: false
            //clickCallBack : ()=>{ myClickImplementation()}
          }),
          new CardViewTextItemModel({
            label: 'Access',
            value: this.veoNode?.properties['vers:consignmentAccess'],
            key: 'veo-consignment-access',
            //default: 'default bar' ,
            multiline: false
            //clickCallBack : ()=>{ myClickImplementation()}
          }),
        ];

        if(this.veoCreationFailed && this.veoNode?.properties["veoGenerationErrorMessage"]){
          this.veoNodeDisplayProperties.push(new CardViewTextItemModel({
            label: 'Error Message',
            value: this.veoNode?.properties['vers:veoGenerationErrorMessage'],
            key: 'veo-error-message',
            //default: 'default bar' ,
            multiline: true
            //clickCallBack : ()=>{ myClickImplementation()}
          }));
        }
      }
    });
  }
}

/** Show the preview for either the veo or the record */
onNameClick(){

  console.log("Name Clicked", this.veoNode);
  if(this.veoNode){
    // if its a record show the preview for the veo
    if(this.isVeo){
      // if its a veo get the record and show the preview for the record

      this.versService.getRecordFromVeo(this.veoNode)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((record: Node | undefined) => {
        if (record) {
          this.showPreview( record );
        }
      });


      }else{
        // if its a record show the preview for the veo
        this.showPreview( this.veoNode );

    }
  }
}

regenerateVeo(){

  console.log("Regenerate VEO", this.veoNode);
  this.versService.retryVeoCreation(this.veoNode);


}

/** display a node in the preview page */
showPreview(node: Node) {
      if (node) {

          let id: string;

          if (node.nodeType === 'app:filelink') {
            id = node.properties['cm:destination'];
          } else {
            id = (node as any).nodeId || (node as any).guid || node.id;
          }

          this.store.dispatch(new ViewNodeAction(id, { location: this.router.url }));

      }
    }
}
