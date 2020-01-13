import {Injectable, Injector} from "@angular/core";
import {OpModalService} from "app/components/op-modals/op-modal.service";
import {HalResourceService} from "app/modules/hal/services/hal-resource.service";
import {I18nService} from "core-app/modules/common/i18n/i18n.service";
import { TimeEntryResource } from 'core-app/modules/hal/resources/time-entry-resource';
import { TimeEntryEditModal } from './edit.modal';
import { take } from 'rxjs/operators';
import {TimeEntryCreateModal} from "core-app/modules/calendar/te-calendar/create/create.modal";
import {FormResource} from "core-app/modules/hal/resources/form-resource";
import {TimeEntryDmService} from "core-app/modules/hal/dm-services/time-entry-dm.service";
import {ResourceChangeset} from "core-app/modules/fields/changeset/resource-changeset";
import {HalResourceEditingService} from "core-app/modules/fields/edit/services/hal-resource-editing.service";
import { Moment } from 'moment';

@Injectable()
export class TimeEntryEditService {

  constructor(readonly opModalService:OpModalService,
              readonly injector:Injector,
              readonly halResource:HalResourceService,
              readonly timeEntryDm:TimeEntryDmService,
              protected halEditing:HalResourceEditingService,
              readonly i18n:I18nService) {
  }

  public edit(entry:TimeEntryResource) {
    return new Promise<{entry:TimeEntryResource, action:'update'|'destroy'}>((resolve, reject) => {
      const modal = this.opModalService.show(TimeEntryEditModal, this.injector, { entry: entry });

      modal
        .closingEvent
        .pipe(take(1))
        .subscribe(() => {
          if (modal.destroyedEntry) {
            modal.destroyedEntry.delete().then(() => {
              resolve({entry: modal.destroyedEntry, action: 'destroy'});
            });
          } else if (modal.modifiedEntry) {
            resolve({ entry: modal.modifiedEntry, action: 'update' });
          } else {
            reject();
          }
        });
    });
  }

  public create(date:Moment) {
    return new Promise<{entry:TimeEntryResource, action:'create'}>((resolve, reject) => {
      this
        .createNewTimeEntry(date)
        .then(changeset => {
          const modal = this.opModalService.show(TimeEntryCreateModal, this.injector, { entry: changeset.pristineResource });

          modal
            .closingEvent
            .pipe(take(1))
            .subscribe(() => {
              if (modal.createdEntry) {
                resolve({entry: modal.createdEntry, action: 'create'});
              } else {
                reject();
              }
            });

        });
    });
  }

  public createNewTimeEntry(date:Moment) {
    return this.timeEntryDm.createForm({ spentOn: date.format('YYYY-MM-DD') }).then(form => {
      return this.fromCreateForm(form);
    });
  }

  public fromCreateForm(form:FormResource):ResourceChangeset {
    let entry = this.initializeNewResource(form);

    return this.halEditing.edit<TimeEntryResource, ResourceChangeset<TimeEntryResource>>(entry, form);
  }

  private initializeNewResource(form:FormResource) {
    let entry = this.halResource.createHalResourceOfType<TimeEntryResource>('TimeEntry', form.payload.$plain());

    entry.$links['schema'] = form.schema;
    entry.overriddenSchema = form.schema;

    entry['_type'] = 'TimeEntry';
    entry['id'] = 'new';
    entry['hours'] = 'PT1H';

    // Set update link to form
    entry['update'] = entry.$links['update'] = form.$links.self;
    // Use POST /work_packages for saving link
    entry['updateImmediately'] = entry.$links['updateImmediately'] = (payload:{}) => {
      return this.timeEntryDm.create(payload);
    };

    entry.state.putValue(entry);

    return entry;
  }
}
