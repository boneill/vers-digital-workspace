/*!
 * Seed IM: display details on veo for record
 */

import { ChangeDetectorRef, Component, DestroyRef, inject, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { TranslationService, IconComponent, NotificationService } from '@alfresco/adf-core';
import { CommonModule } from '@angular/common';

import { MatTooltipModule } from '@angular/material/tooltip';
import { NodeAssociationEntry, NodeEntry } from '@alfresco/js-api';
import { NodesApiService, ShareDataRow } from '@alfresco/adf-content-services';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { AppStore, ViewNodeAction } from '@alfresco/aca-shared/store';
import { Router } from '@angular/router';
import { VersService } from '../../services/vers.service';

@Component({
  imports: [CommonModule, MatTooltipModule, IconComponent],
  selector: 'vers-veo-details-column',
  templateUrl: './veo-details.component.html',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'adf-datatable-content-cell adf-datatable-link adf-name-column aca-custom-name-column'
  }
})
export class VeoDetailsColumnComponent implements OnInit {
  @Input()
  context: any;

   node!: NodeEntry;

   badgeValue?:string;

  private readonly destroyRef = inject(DestroyRef);

   protected store = inject<Store<AppStore>>(Store<AppStore>);


  constructor(private translation: TranslationService,
    private nodesApiService: NodesApiService,
    private router: Router,
    private versService: VersService,
    private notificationService: NotificationService,
    private cd: ChangeDetectorRef) {
  }


  ngOnInit() {

    //console.log('VeoDetailsComponent.onInit context:', this.context);
    this.updateValue();

        this.nodesApiService.nodeUpdated.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((node) => {
            const row: ShareDataRow = this.context.row;
            if (row) {
                const { entry } = row.node;

                if (entry === node) {
                    row.node = { entry };
                    this.updateValue();
                }
            }
        });
    }

  protected updateValue() {
    this.node = this.context.row.node;

    //console.log("updateValue: File record detected", this.node);

    // for records that are part of a file (recordfolder)
    // we have to evaluate based on the parent file to see the veo ceate status
    if(this.node?.entry?.isFile && this.node?.entry.aspectNames?.includes("rma:cutOff")
      && this.node?.entry.properties["rma:recordSearchHasDispositionSchedule"] == false
      && !this.node?.entry.aspectNames?.includes("rma:dispositionLifecycle")){
        console.log("File record detected");
        if(this.node?.entry?.parentId){
          this.nodesApiService.getNode(this.node.entry.parentId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((parentNode) => {
            this.node = {entry: parentNode};
            // Trigger change detection so the icon refreshes
            this.badgeValue = "📎";
            //console.log("change detect triggered");
            this.cd.detectChanges();

          });
        }
    }
  }

  getVeoStatusIcon(): string {

    if (!this.node?.entry?.properties) return ''; // avoid undefined errors
    //console.log("vers:veoStatus value", this.node.entry.properties["vers:veoStatus"]);
    const veoStatus = this.node.entry.properties["vers:veoStatus"];

      switch (veoStatus) {
        case "success":
          return 'vers:veo-status-success';
        case "pending":
          return 'vers:veo-status-pending';
        case "failed":
          return 'vers:veo-status-failed';
        default:
          return '';
      }
  }

  getToolTip(): string {

      //const veoStatus = row.getValue("properties.vers:veoStatus");
    const veoStatus = this.node?.entry.properties["vers:veoStatus"];

      switch (veoStatus) {
        case "success":
          return this.translation.instant('VERS.DOCUMENT_LIST.VEO_STATUS.SUCCESS');
        case "pending":
          return this.translation.instant('VERS.DOCUMENT_LIST.VEO_STATUS.PENDING');
        case "failed":
          return this.translation.instant('VERS.DOCUMENT_LIST.VEO_STATUS.FAILED');
        default:
          //console.log("Value is not 0, 1, or 2");
          return '';
      }
  }

  /** Show the preview for the veo */
  onIconClick(event: any): void {
    event.stopPropagation();
    //console.log('Icon clicked for context:', this.node);
    if( this.node?.entry?.nodeType && this.node?.entry?.nodeType !== "vers:veo" ){

      this.versService.getVeoNodeFromRecord(this.node.entry)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (veoNode) => {
            if (veoNode) {
              console.log('Got VEO node:', veoNode);
              // you can now use veoNode here
              const status = veoNode.entry.properties["vers:veoStatus"];
              if( status == "success"){
                this.showPreview(veoNode);
              }else if( status == "failed"){
                this.showFailedReason(veoNode);
              }else if ( status == "pending" ){
                this.notificationService.showInfo(`VEO creation is pending creation.`);
              }
            } else {
              console.log('No VEO node found for Record');
              this.notificationService.showWarning("Could not find VEO for this record");
            }
          },
          error: (err) => {
            console.error('Error loading VEO node', err);
            this.notificationService.showWarning("Could not find VEO for this record");
          }
        });

    }
  }

  showFailedReason(veoNode: NodeAssociationEntry) {
    const translatedMessage: string = "Error creating VEO: " + veoNode.entry.properties["vers:veoGenerationErrorMessage"];
    //const action: string = this.translation.instant('VERS.ACTION_RETRY_CREATE_VEO_TITLE');

    // this.notificationService.openSnackMessage(
    //   translatedMessage,
    //   { panelClass: `adf-warn-snackbar` }
    // );

    this.notificationService.showWarning(translatedMessage);
  }

  //  showFailedReason(veoNode: NodeAssociationEntry) {
  //   const translatedMessage: string = "Error creating VEO: " + veoNode.entry.properties["vers:veoGenerationErrorMessage"];
  //   const action: string = this.translation.instant('VERS.ACTION_RETRY_CREATE_VEO_TITLE');

  //   const snackBarRef = this.notificationService.openSnackMessageAction(
  //     translatedMessage,
  //     action,
  //     { panelClass: `adf-warn-snackbar` }
  //   );

  //   if (action) {
  //     snackBarRef.onAction().subscribe(() => {
  //       this.versService.retryVeoCreation(veoNode);
  //     });
  //   }
  // }


  showPreview(node: NodeEntry) {
      if (node?.entry) {

          let id: string;

          if (node.entry.nodeType === 'app:filelink') {
            id = node.entry.properties['cm:destination'];
          } else {
            id = (node as any).entry.nodeId || (node as any).entry.guid || node.entry.id;
          }

          this.store.dispatch(new ViewNodeAction(id, { location: this.router.url }));
      }
    }

    hasVeoStatus(): boolean {
      return !!this.node?.entry?.properties?.['vers:veoStatus'];
    }

}


