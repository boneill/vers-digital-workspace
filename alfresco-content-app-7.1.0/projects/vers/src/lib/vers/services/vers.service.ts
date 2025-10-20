

import { LogService, NotificationService } from '@alfresco/adf-core';
import { Node, NodeEntry } from '@alfresco/js-api';
import { inject, Injectable } from '@angular/core';
import { Observable, of, Subject, switchMap, tap } from 'rxjs';
import { ContentApiService } from '@alfresco/aca-shared';
import { ContentNodeDialogService, ContentNodeSelectorComponent, ContentNodeSelectorComponentData, DocumentListService, NodesApiService, ShareDataRow } from '@alfresco/adf-content-services';
import { MatDialog } from '@angular/material/dialog';
import { TransferFolderDialog } from '../dialogs/transfer-folder-dialog/transfer-folder.dialog';




@Injectable({
  providedIn: 'root'
})
export class VersService {

  private notificationService = inject(NotificationService);
  private readonly createMenuButtonSelector = 'app-toolbar-menu button[id="app.toolbar.create"]';

  constructor( private logService: LogService,
    private contentApi: ContentApiService,
    private nodesApiService: NodesApiService,
    private dialogRef: MatDialog,
    private documentListService: DocumentListService){}


   getVersTransfersRootFolder(): Observable<Node> {
    this.logService.trace("getAppConfigFileNode entered");
    return this.contentApi.getNode('-root-', {
      includeSource: true,
      include: ['path', 'properties', 'allowableOperations'],
      relativePath:
        '/Sites/veo-transfers/documentLibrary'
    }).pipe(
      tap(result => console.log("getVersTransfersRootFolder", result)),
      switchMap(result => {

        return this.getOrCreateFolder("Transfers", "cm:folder", result.entry.id);
      })
    );
  }

  /**
   * Service to create a transfer folder.
   * It opens a dialog get the transfer details and then creates the transfer
   * Once these are obtained, on the dialog close it creates the transfer
   *
   * @param sourceNode
   */
  public createTransferFolder() {
    console.log("VersService createTransferFolder called");


    this.getVersTransfersRootFolder().pipe(
      // switchMap((parentFolderNode) => {
      //   // Use the parent folder node's id to create the new subfolder inside it
      //   return this.getOrCreateFolder("VEO Transfers", "cm:folder", parentFolderNode.entry.id);
      // })
    ).subscribe({
        next: (rootTransferFolderNode: Node) => {
          console.log('Subfolder created or already exists:', rootTransferFolderNode);

          const parentNodeId = rootTransferFolderNode.id;

          const dialogInstance = this.dialogRef.open(TransferFolderDialog, {
            data: {
              parentNodeId,
              createTitle: undefined,
              nodeType: 'vers:transfer'
            },
            width: '400px',
            role: 'dialog'
          });

          dialogInstance.componentInstance.error.subscribe((message: string) => {
            this.notificationService.showError(message);
          });

          dialogInstance.afterClosed().subscribe((node) => {
            if (node) {
              this.documentListService.reload();
            }
            this.focusAfterClose(this.createMenuButtonSelector);
          });

        },
        error: (err) => {
          console.error('Error creating subfolder:', err);
          this.notificationService.showError(err);
        }
    });
  }

    /**
   * Service to create a veo in a transfer folder.
   *
   * It opens a dialog get the transfer details and then Queues the veos for creation
   * by adding the veo lifelcycle aspect to each veo.
   *
   * @param sourceNode
   */
  public queueVeosForCreation(records: NodeEntry[]) {
    console.log("VersService queueVeosForCreation called", records);

    //open a dialog to request which transfer to create veo for.
    this.getVersTransfersRootFolder().subscribe(rootFolder => {

      this.getConsignmentTransferSelection(rootFolder.id).subscribe(result => console.log("selected" , result));


    });



    // this.getVersTransfersRootFolder().pipe(
    //   // switchMap((parentFolderNode) => {
    //   //   // Use the parent folder node's id to create the new subfolder inside it
    //   //   return this.getOrCreateFolder("VEO Transfers", "cm:folder", parentFolderNode.entry.id);
    //   // })
    // ).subscribe({
    //     next: (rootTransferFolderNode: Node) => {
    //       console.log('Subfolder created or already exists:', rootTransferFolderNode);

    //       const parentNodeId = rootTransferFolderNode.id;

    //       const dialogInstance = this.dialogRef.open(TransferFolderDialog, {
    //         data: {
    //           parentNodeId,
    //           createTitle: undefined,
    //           nodeType: 'vers:transfer'
    //         },
    //         width: '400px',
    //         role: 'dialog'
    //       });

    //       dialogInstance.componentInstance.error.subscribe((message: string) => {
    //         this.notificationService.showError(message);
    //       });

    //       dialogInstance.afterClosed().subscribe((node) => {
    //         if (node) {
    //           this.documentListService.reload();
    //         }
    //         this.focusAfterClose(this.createMenuButtonSelector);
    //       });

    //     },
    //     error: (err) => {
    //       console.error('Error creating subfolder:', err);
    //       this.notificationService.showError(err);
    //     }
    // });

  }

getOrCreateFolder(folderName: string, nodeType: string, parentNodeId: string = '-my-'): Observable<Node> {
    console.log("getOrCreateFolder", folderName, nodeType, parentNodeId);
    return this.nodesApiService.getNodeChildren(parentNodeId).pipe(
      switchMap((children) => {
        const entries = children?.list?.entries ?? [];
        console.log("getOrCreateFolder: Children of root node", entries);
        const existingFolder = entries.find(
          (entry) =>
            entry.entry.name.toLowerCase() === folderName.toLowerCase() &&
            entry.entry.nodeType === nodeType
        );

        if (existingFolder) {
          console.log("getOrCreateFolder: existing folder", existingFolder.entry);
          // Folder already exists, return as observable
          return of(existingFolder.entry);
        } else {
          // Folder doesn't exist, create it
          console.log("getOrCreateFolder: Folder doesn't exist, create it");
          const folderBody = {
            name: folderName,
            nodeType: nodeType
          };
          return this.nodesApiService.createFolder(parentNodeId, folderBody );
        }
      })
    );
  }

  private focusAfterClose(focusedElementSelector: string): void {
      if (focusedElementSelector) {
        document.querySelector<HTMLElement>(focusedElementSelector)?.focus();
      }
    }

    getConsignmentTransferSelection(/*action: NodeAction, contentEntities: NodeEntry[], */transferRootFolder: string,  focusedElementOnCloseSelector?: string): Subject<Node[]> {
        //const currentParentFolderId = '-root-'


        const title = "Select Consignment Transfer";


        const data: ContentNodeSelectorComponentData = {
          selectionMode: 'single',
          title,
          currentFolderId: transferRootFolder,
          //actionName: action,
          dropdownHideMyFiles: true,
          showDropdownSiteList: false,
          showSearch: false,
          showFilesInResult: false,
          showLocalUploadButton: false,
          rowFilter: this.transfersRowFilter.bind(this),
          //imageResolver: this.imageResolver.bind(this),
          //breadcrumbTransform: this.customizeBreadcrumb.bind(this),
          select: new Subject<Node[]>(),
          excludeSiteContent: ContentNodeDialogService.nonDocumentSiteContent
        };

        this.dialogRef
          .open(ContentNodeSelectorComponent, {
            data,
            panelClass: 'adf-content-node-selector-dialog',
            width: '630px',
            role: 'dialog'
          })
          .afterClosed()
          .subscribe(() => {

            if(focusedElementOnCloseSelector)
              this.focusAfterClose(focusedElementOnCloseSelector)

          });

        data.select.subscribe({
          complete: this.close.bind(this)
        });

        return data.select;
  }

  /** filter rows to only show transfer folders */
  private transfersRowFilter(row: ShareDataRow): boolean {
      const node: Node = row.node.entry;

      return !node.isFile && node.nodeType !== 'vers:transfer';
    }

    close() {
    this.dialogRef.closeAll();
  }



}

