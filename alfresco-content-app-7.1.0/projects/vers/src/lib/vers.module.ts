import { EnvironmentProviders, NgModule, Provider } from '@angular/core';

import { provideExtensionConfig, provideExtensions} from '@alfresco/adf-extensions';
import { provideTranslations} from '@alfresco/adf-core';

// import { VersComponent } from './vers/vers.component';
// import { VersService } from './vers/services/vers.service';
import { provideEffects } from '@ngrx/effects';
import { VersEffects } from './vers/effects/vers.effects';
import { hasDispositionLifecycle, isParentTransferFolder, isRecordsManager, isRootForTransfers, isTransferFolder } from './vers/rules/actions.rules';
//import { MyExtensionService } from './my-extension.service';


export function provideVersExtension(): (Provider | EnvironmentProviders)[] {
  return [
    provideExtensionConfig(['vers.plugin.json']),
    provideTranslations('vers', 'assets/vers'),
    provideEffects(VersEffects),
    provideExtensions({
      evaluators: {
        'vers.navigation.isRootForTransfers': isRootForTransfers,
        'vers.selection.isTransferFolder': isTransferFolder,
        'vers.navigation.isParentTransferFolder': isParentTransferFolder,
        'vers.role.isRecordsManager': isRecordsManager,
        'vers.selection.hasDispositionLifecycle': hasDispositionLifecycle
      }
    })
  ];
}

// @NgModule({
//   imports: [
//     VersComponent,
//     EffectsModule.forFeature([VersEffects]),
//   ],
//   providers: [
//     //provideTranslations('vers', 'assets/vers'),
//     VersService,
//     provideExtensionConfig(['vers.plugin.json']),
//   ]
// })
@NgModule({
  providers: [...provideVersExtension()]
})
export class VersModule {
}

