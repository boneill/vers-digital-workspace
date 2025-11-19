

import { LogService, NotificationService } from '@alfresco/adf-core';
import { AssociationBody, Node, NodeAssociationEntry, NodeAssociationPaging, NodeEntry } from '@alfresco/js-api';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, from, map, Observable, of, Subject, switchMap, take, takeUntil } from 'rxjs';
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
      switchMap(result => {
        console.log("getVersTransfersRootFolder", result);
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

          dialogInstance.componentInstance.error
            .pipe(takeUntil(dialogInstance.afterClosed()))
            .subscribe((message: string) => {
            this.notificationService.showError(message);
          });

          dialogInstance.afterClosed().pipe(take(1)).subscribe((node) => {
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
   * by adding the veo lifecycle aspect to each veo.
   *
   * @param sourceNode
   */
  public queueVeosForCreation(records: NodeEntry[]) {
    console.log("VersService queueVeosForCreation called", records);

    //open a dialog to request which transfer to create veo for.
    this.getVersTransfersRootFolder().subscribe(rootFolder => {

      this.getConsignmentTransferSelection(rootFolder.id).subscribe(selectedTransfer => {

        console.log("selected" , selectedTransfer);
        if(selectedTransfer && selectedTransfer[0]){
          this.createVEOs(selectedTransfer[0], records);

        }
      });

    });
  }


  /**
   * Create a veo node for each of the records in the transfer folder
   *
   * @param selectedTransfer
   * @param records
   */

createVEOs(transferNode: Node, records: NodeEntry[]) {
  console.log(`createVEOs: in ${transferNode}`, records);

  const creationObservables = records.map((record) => {
    console.log(`Processing Node ID: ${record.entry.id}, Name: ${record.entry.name}`, record.entry);

    // Build VEO name
    let veoName = record.entry.name.lastIndexOf(".") > 0
      ? record.entry.name.substring(0, record.entry.name.lastIndexOf("."))
      : record.entry.name;

    if (record.entry.isFolder) {
      veoName += `(${record.entry.properties["rma:identifier"]})`;
    }
    veoName += ".veo.zip";

    // Define the new VEO node
    const nodeBody = {
      name: veoName,
      nodeType: "vers:veo",
      properties: {
        'vers:veoStatus': 'pending',
        'vers:consignmentId': transferNode.properties['vers:consignmentId'],
        'vers:consignmentAccess': transferNode.properties['vers:consignmentAccess'],
        'vers:linkedRecordNodeRef': record.entry.id,
        'vers:linkedRecordName': record.entry.name
      }
    };

    // ---- Main Observable ----
    return this.nodesApiService.createNode(transferNode.id, nodeBody).pipe(
      switchMap((veoNode) => {
        console.log(`✅ Created VEO for ${record.entry.name}`);

        return this.addAssociationFromVeoToRecord(record.entry, veoNode).pipe(
          map(() => ({
            record,
            success: true,
            result: veoNode
          })),
          catchError(assocErr => {
            console.warn(`⚠️ Failed to add association for ${record.entry.name}`, assocErr);
            // Decide whether to continue updating status even if association fails
            return this.updateVeoStatus(veoNode, 'failed').pipe(
              map(() => ({
                record,
                success: false,
                result: veoNode,
                associationError: assocErr
              }))
            );
          })
        );
      }),
      catchError((createErr) => {
        console.error(`❌ Failed to create VEO for ${record.entry.name}`, createErr);
        return of({
          record,
          success: false,
          error: createErr
        });
      })
    );
  });

  forkJoin(creationObservables).subscribe((results) => {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    this.onVeoCreationComplete({ success: successful, failure: failed });
  });
}

/**
   * Create a veo node for each of the records in the transfer folder
   *
   * @param veo Node to try to create zip for.
   *
   * @param records
   */
public retryVeoCreation(veoNode: Node | undefined) {
  //console.log(`retryVeoCreation`, veoNode);
  if(veoNode){
  console.log(`retryVeoCreation for Node ID: ${veoNode.id}, Name: ${veoNode.name}`, veoNode);

    this.updateVeoStatus(veoNode, 'pending').subscribe(value => {
      this.notificationService.showInfo("The VEO create retry has been queued for " + value.name);
    });
  }
}


// createVEOs(transferNode: Node, records: NodeEntry[]) {
//   console.log(`createVEOs: in ${transferNode}`, records);

//   const creationObservables = records.map((record) => {
//     console.log(`Processing Node ID: ${record.entry.id}, Name: ${record.entry.name}`, record.entry);

//     // Build VEO name
//     let veoName = record.entry.name.lastIndexOf(".") > 0?
//       record.entry.name.substring(0, record.entry.name.lastIndexOf(".")) : record.entry.name;

//       if (record.entry.isFolder) {
//       veoName += `(${record.entry.properties["rma:identifier"]})`;
//     }
//     veoName += ".veo.zip";

//     // Define the new VEO node
//     const nodeBody = {
//       name: veoName,
//       nodeType: "vers:veo",
//       properties: {
//         'vers:veoStatus': 'pending',
//         'vers:consignmentId': transferNode.properties['vers:consignmentId'],
//         'vers:consignmentAccess': transferNode.properties['vers:consignmentAccess'],
//         'vers:linkedRecordNodeRef': record.entry.id
//       }
//     };

//     // ---- Main Observable ----
//     return this.nodesApiService.createNode(transferNode.id, nodeBody).pipe(
//       // ✅ If createNode succeeds
//       switchMap((result) => {
//         console.log(`✅ Created VEO for ${record.entry.name}`);

//         this.addAssociationFromVeoToRecord(record.entry, result); //TODO add this to a switchmap

//         return this.updateRecordStatus(record.entry, 'pending').pipe(
//           map(() => ({
//             record,
//             success: true,
//             result
//           })),
//           catchError(updateErr => {
//             console.warn(`⚠️ Created VEO but failed to add aspect to record ${record.entry.name}`, updateErr);
//             return of({
//               record,
//               success: true,
//               result,
//               updateError: updateErr
//             });
//           })
//         );
//       }),
//       // ❌ If createNode fails
//       catchError((error) => {
//         console.error(`❌ Failed to create VEO for ${record.entry.name}`, error);
//         return this.updateRecordStatus(record.entry, 'failed').pipe(
//           map(() => ({
//             record,
//             success: false,
//             error
//           })),
//           catchError(updateError => {
//             console.error(`⚠️ Failed to add aspect to record after VEO creation error`, updateError);
//             return of({
//               record,
//               success: false,
//               error,
//               updateError
//             });
//           })
//         );
//       })
//     );
//   });

//   forkJoin(creationObservables).subscribe((results) => {
//     const successful = results.filter(r => r.success);
//     const failed = results.filter(r => !r.success);

//     this.onVeoCreationComplete({ success: successful, failure: failed });
//   });
// }


/**
 * Callback for CreateVEOs method.  Used to log results
 */
onVeoCreationComplete(result: { success: any[], failure: any[] }) {
  console.log('VEO creation completed.');
  console.log(`✅ Successes: ${result.success.length}`);
  console.log(`❌ Failures: ${result.failure.length}`);

  // Add any additional logic you want here
  if (result.failure.length > 0) {
    const failedNames = result.failure.map(f => f.record.entry.name);
    console.warn('❌ Failed node names:', failedNames.join(', '));
    this.notificationService.showError("Could not create VEOS for " + failedNames.join(', '));
  }else{
    this.notificationService.showInfo(`${result.success.length} records have been queued for VEO creation`);
  }

   this.documentListService.reload();
}

/**
 * Update the record with an aspect that signifies the VEO creation status.
 *
 * @param record
 * @param status
 * @returns
 */
/**
 * Update the Veo with the veo status
 *
 * @param veo
 * @param status
 * @returns
 */
private updateVeoStatus(veo: Node,  status: 'pending' | 'success' | 'failed') {
  //const aspect = 'vers:veoStatus' + status.charAt(0).toUpperCase() + status.slice(1);
  console.log(`Adding veoStatus of status ${status} to veo ${veo.id}`);
  var properties = veo.properties;
  if(properties){
    properties["vers:veoStatus"] = status;
  }

  return this.nodesApiService.updateNode(veo.id, {
      properties: properties
    });
}


// private updateRecordStatus(record: Node,  status: 'pending' | 'success' | 'failed') {
//   const aspect = 'vers:veoStatus' + status.charAt(0).toUpperCase() + status.slice(1);
//   console.log(`Adding veoStatus of aspect ${aspect} to record ${record.id}`);

//   // Helper function to perform the update once we have aspectNames
//   const applyUpdate = (aspectNames: string[] = []) => {
//     return this.nodesApiService.updateNode(record.id, {
//       aspectNames: [...aspectNames, aspect]
//     });
//   };

//   // If aspectNames are already available, update directly
//   if (record.aspectNames) {
//     return applyUpdate(record.aspectNames);
//   }



//   // Otherwise, fetch the node first, then update
//   return this.nodesApiService.getNode(record.id).pipe(
//     switchMap((node: Node) => {
//     const aspectNames = node.aspectNames || [];
//     return applyUpdate(aspectNames);
//   }));
// }

/**
 * Update the VEO to add the association between the veo and the record
 *
 * @param record
 * @param status
 * @returns
 */
private addAssociationFromVeoToRecord(record: Node, veo: Node) {
    const body: AssociationBody = {
          targetId: record.id,
          assocType: "vers:linkedRecord"
    };

    return from(this.nodesApiService.nodesApi.createAssociation(veo.id, body));

}

/**
 * Get VEO node associated with the record.  It should be based on an assocation set on the
 * veo that points at the record.
 *
 * @param record
 * @param status
 * @returns
 */
public getVeoNodeFromRecord(record: Node): Observable<NodeAssociationEntry | null> {
  const opts = {
    where: `(assocType='vers:linkedRecord')`,
    include:['properties']
  };

  return from(
    this.nodesApiService.nodesApi.listSourceAssociations(record.id, opts)
  ).pipe(
    map((res: NodeAssociationPaging) => {
      const associations = res?.list?.entries || [];
      return associations.length ? associations[0] : null; // return single item or null
    })
  );
}

/**
 * Get the record associated with the veo.  It should be based on an assocation set on the
 * veo that points at the record.
 *
 * @param Node of type vers:veo
 * @param status
 * @returns
 */
public getRecordFromVeo(veo: Node): Observable<Node | undefined> {

  if (!veo || veo.nodeType !== "vers:veo") {
    return of(undefined);
  }

  const opts = {
    where: `(assocType='vers:linkedRecord')`,
    include:['properties']
  };

  return from(
    this.nodesApiService.nodesApi.listTargetAssociations(veo.id, opts)
  ).pipe(
    map((res: NodeAssociationPaging) => {
      const associations = res?.list?.entries || [];
      return associations.length ? associations[0]?.entry : undefined; // return single item or null
    })
  );
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

    /**
     * Provide a dialog for a user to select which transfer they want the VEO to be created against.
     *
     * @param transferRootFolder
     * @param focusedElementOnCloseSelector
     * @returns
     */
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
          isSelectionValid: this.isSelectionValid.bind(this),
          //imageResolver: this.imageResolver.bind(this),
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
          .pipe(take(1))
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
      console.log("transferRowFilter", node);
      return node.isFolder && node.nodeType == 'vers:transfer';
    }

  close() {
    this.dialogRef.closeAll();
  }

  private isSelectionValid(node: Node): boolean {
    if (!node?.path?.elements?.length || node?.nodeType !== "vers:transfer") {
      return false;
    }

    return node.isFolder;
  }
}

