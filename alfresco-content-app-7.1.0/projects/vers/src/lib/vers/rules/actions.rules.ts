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
  //console.log('isVeoCreationPending Context: ', context);

  if (context.selection && !navigation.isTrashcan(context)) {
    return context.selection.nodes.every((node: any) => node.entry &&
      (node.entry?.properties['vers:veoStatus'] == "pending"));
  }
  return false;
}

/**
 * checks if a record has veo creation status of success
 *
 * JSON ref: 'vers.selection.hasVeoCreationSucceeded'
 */
export function hasVeoCreationSucceeded(context: RuleContext): boolean {
  console.log('hasVeoCreationSucceeded Context: ', context);

  if (context.selection && !navigation.isTrashcan(context)) {
    return context.selection.nodes.every((node: any) => node.entry &&
      (node.entry?.properties['vers:veoStatus'] == "success"));
  }
  return false;
}

/**
 * checks if a record has veo creation status of Failed
 *
 * JSON ref: 'vers.selection.hasVeoCreationFailed'
 */
export function hasVeoCreationFailed(context: RuleContext): boolean {
  //console.log('hasVeoCreationFailed Context: ', context);

  if (context.selection && !navigation.isTrashcan(context)) {
    return context.selection.nodes.every((node: any) => node.entry &&
      (node.entry?.properties['vers:veoStatus'] == "failed"));
  }
  return false;
}

/**
 * checks if a record is already part of a veo creation process
 *
 * JSON ref: 'vers.selection.isPartOfVeoCreationRequest'
 */
export function isPartOfVeoCreationRequest(context: RuleContext): boolean {
  //console.log('isPartOfVeoCreationRequest Context: ', context);

  if (context.selection &&
    (hasVeoCreationFailed(context) ||
    isVeoCreationPending(context) ||
    hasVeoCreationSucceeded(context))
  ) {
    //console.log('isPartOfVeoCreationRequest true ');
      return true;
  }
  //console.log('isPartOfVeoCreationRequest false ');
  return false;
}


/**
 * checks if a node has a disposition lifecycle attached
 * VEO's can only be created if they are part of a disposition schedule (RDA)
 * JSON ref: 'vers.selection.hasDispositionLifecycle'
 */
export function hasDispositionLifecycle(context: RuleContext): boolean {
  //console.log('hasDispositionLifecycle Context: ', context);

  //console.log('hasDispositionLifecycle login: ', !context.selection.isEmpty && !navigation.isTrashcan(context));

  if (context.selection && !navigation.isTrashcan(context)) {
    return context.selection?.nodes?.every((node: any) => node.entry
      &&
      (
        (node.entry?.aspectNames?.includes('rma:dispositionLifecycle'))  ||
        // need the additional check as the selected node will not
        // have the aspectNames element if selected from search
        (node.entry?.properties['rma:recordSearchHasDispositionSchedule'] == true)

      )
    );
  }
  //console.log("returning false");
  return false;
}

/**
 checks if the current navigation is within the vers-transfers site

 *
 * JSON ref: 'vers.navigation.isVeoTransfersSite'
 */
export function isVeoTransfersSite (context: RuleContext): boolean {

  console.log('isVeoTransfersSite Context: ', context, navigation);

  if (context && context.navigation && context.navigation.currentFolder
    && context.navigation.currentFolder.path?.name && context.navigation.currentFolder.path.name.includes('/Company Home/Sites/veo-transfers') ) {

      console.log("isVeoTransfersSite true", context);
      return true;
  }

  console.log("isVeoTransfersSite false");
  return false;
}
