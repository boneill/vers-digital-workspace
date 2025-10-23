import { RuleContext } from '@alfresco/adf-extensions';
import * as navigation from '@alfresco/aca-shared/rules';
//import { PathElement } from '@alfresco/js-api';

/**
 * Checks if user selected anything.
 * JSON ref: `app.selection.notEmpty`
 */
export function hasSelection(context: RuleContext): boolean {
  return !context.selection.isEmpty;
}

export function hasFolderSelected(context: RuleContext): boolean {
  if (context && context.selection && context?.selection?.folder) {
    return true;
  }
  return false;
}
export function hasFileSelected(context: RuleContext): boolean {
  if (context?.selection?.file) {
    return true;
  }
  return false;
}

/**
 * Checks if node is in a vers:transfer folder.
 * JSON ref: `vers.navigation.isParentTransferFolder`
 */
 export function isParentTransferFolder(context: RuleContext): boolean {

  //console.log("isParentClientFolder folder", context);

  if (context && context.navigation && context.navigation.currentFolder
    && context.navigation.currentFolder.nodeType == 'vers:transfer' ) {

      //console.log("isParentClientFolder folder true", context);
      return true;
  }

  return false;
}

/**
 * Checks if node is in a vers:transfer folder.
 * JSON ref: `vers.navigation.isRootForTransfers`
 */
 export function isRootForTransfers(context: RuleContext): boolean {

  //console.log("isRootForTransfers folder", context);

  if (context && context.navigation && context.navigation.currentFolder
    && context.navigation.currentFolder.path?.name && context.navigation.currentFolder?.name == "Transfers" && context.navigation.currentFolder.path.name.includes('/Company Home/Sites/veo-transfers/documentLibrary') ) {

      //console.log("isRootForTransfers true", context);
      return true;
  }

  return false;
}


 /**
 * Checks if node is a vers:transfer folder
 * JSON ref: `vers.selection.isTransferFolder`
 */
export function isTransferFolder(context: RuleContext): boolean {
  //console.log('Rule Context: ', context);
  if (hasFolderSelected(context)) {
    if (context?.selection?.folder?.entry.nodeType === 'vers:transfer') {
      return true;
    }
  }

  return false;
}

/**
 * Checks if node is in VEO Transfers site.
 * JSON ref: `vers.selection.isInVeoTransfersSite`
 */
 export function isInVeoTransfersSite(context: RuleContext): boolean {
  //console.log('isInVeoTransfersSite Rule Context: ', context);


  if (hasFolderSelected(context)) {
    //console.log('Rule Context isInArchiveSite: path ', context?.selection?.folder?.entry.path.name);
    if(context?.selection?.folder?.entry?.path?.name && context.selection.folder.entry.path.name.includes('/Company Home/Sites/veo-transfers')){
      //console.log("isInArchiveSite", true);
      return true;
    }
  }else if (!context.selection.isEmpty && !navigation.isTrashcan(context)) {
    //console.log("isInArchiveSite", context.selection.nodes.every((node: any) => node.entry && (node.entry.isFile && node.entry.path.name && node.entry.path.name.includes('/Company Home/Sites/archive'))));
    return context.selection.nodes.every((node: any) => node.entry && (node.entry.isFile && node.entry.path.name && node.entry.path.name.includes('/Company Home/Sites/veo-transfer')));
  }
  // default return false if path does not match
  //console.log("isInArchiveSite", false);
  return false;
}

/**
 * Checks if user has Records Manager Role
 *
 * JSON ref: `vers.role.isRecordsManager`
 */
export function isRecordsManager(context: RuleContext): boolean {
  let groups = context.profile.groups;
  if (groups && groups.length > 0) {
    for (var group of groups) {
      if (group.id && group.id.indexOf('GROUP_RecordsManager') >= 0) {
        //console.log("Records Manager", group.id);
        return true;
      }
    }
  }
  return false;
}

/**
 * checks if a record has veo creation status of pending
 *
 * JSON ref: 'vers.selection.isVeoCreationPending'
 */
export function isVeoCreationPending(context: RuleContext): boolean {
  //console.log('hasDispositionLifecycle Context: ', context);

  if (!context.selection.isEmpty && !navigation.isTrashcan(context)) {
    return context.selection.nodes.every((node: any) => node.entry
      && (node.entry.aspectNames.includes('vers:veoStatusPending')));
  }
  return false;
}

/**
 * checks if a record has veo creation status of success
 *
 * JSON ref: 'vers.selection.hasVeoCreationSucceeded'
 */
export function hasVeoCreationSucceeded(context: RuleContext): boolean {
  //console.log('hasDispositionLifecycle Context: ', context);

  if (!context.selection.isEmpty && !navigation.isTrashcan(context)) {
    return context.selection.nodes.every((node: any) => node.entry
      && (node.entry.aspectNames.includes('vers:veoStatusSuccess')));
  }
  return false;
}

/**
 * checks if a record has veo creation status of Failed
 *
 * JSON ref: 'vers.selection.hasVeoCreationFailed'
 */
export function hasVeoCreationFailed(context: RuleContext): boolean {
  //console.log('hasDispositionLifecycle Context: ', context);

  if (!context.selection.isEmpty && !navigation.isTrashcan(context)) {
    return context.selection.nodes.every((node: any) => node.entry
      && (node.entry.aspectNames.includes('vers:veoStatusFailed')));
  }
  return false;
}

/**
 * checks if a record is already part of a veo creation process
 *
 * JSON ref: 'vers.selection.isPartOfVeoCreationRequest'
 */
export function isPartOfVeoCreationRequest(context: RuleContext): boolean {
  //console.log('hasDispositionLifecycle Context: ', context);

  if (!context.selection.isEmpty &&
    (hasVeoCreationFailed(context) ||
    isVeoCreationPending(context) ||
    hasVeoCreationSucceeded(context))
  ) {

      return true;
  }
  return false;
}


/**
 * checks if a node has a disposition lifecycle attached
 * VEO's can only be created if they are part of a disposition schedule (RDA)
 * JSON ref: 'vers.selection.hasDispositionLifecycle'
 */
export function hasDispositionLifecycle(context: RuleContext): boolean {
  //console.log('hasDispositionLifecycle Context: ', context);

  if (!context.selection.isEmpty && !navigation.isTrashcan(context)) {
    return context.selection.nodes.every((node: any) => node.entry
      && (node.entry.aspectNames.includes('rma:dispositionLifecycle')));
  }
  return false;



  // var aspects;
  // if (hasFileSelected(context)) {
  //   aspects = context?.selection?.file?.entry?.aspectNames;
  // }
  // else if(hasFolderSelected(context)){
  //   aspects = context?.selection?.folder?.entry?.aspectNames;
  // }

  // if (aspects && aspects.length > 0) {
  //   for (var aspect of aspects) {
  //     if (aspect == 'rma:dispositionLifecycle') {
  //       return true;
  //     }
  //   }
  // }
  // return false;
}
