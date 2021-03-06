/// <reference path="../../includes.ts"/>
/// <reference path="osgiHelpers.ts"/>
/// <reference path="osgiPlugin.ts"/>

/**
 * @module Osgi
 */
module Osgi {

  export var PackagesController = _module.controller("Osgi.PackagesController", ["$scope", "$filter", "workspace", "$templateCache", "$compile", ($scope, $filter:ng.IFilterService, workspace:Workspace, $templateCache:ng.ITemplateCacheService, $compile:ng.IAttributes) => {
    var dateFilter = $filter('date');

    $scope.packages = [];
    $scope.selectedItems = [];

    $scope.mygrid = {
      data: 'packages',
      showFilter: false,
      showColumnMenu: false,
      filterOptions: {
        filterText: "",
        useExternalFilter: false
      },
      selectedItems: $scope.selectedItems,
      rowHeight: 32,
      selectWithCheckboxOnly: true,
      columnDefs: [
        {
          field: 'Name',
          displayName: 'Name',
        },
        {
          field: 'VersionLink',
          displayName: 'Version',
          width: "***",
          cellTemplate: `
            <div class="ngCellText">
              <a ng-href="/osgi/package/{{row.entity.Name}}/{{row.entity.Version}}">{{row.entity.Version}}</a>
            </div>`
        },
        {
          field: 'ExportingBundles',
          displayName: 'Exporting Bundles',
          cellTemplate: `
            <div class="ngCellText">
              <div ng-repeat="bundle in row.entity.ExportingBundles">
                <a title="Exported by bundle {{bundle.Identifier}}" ng-href="/osgi/bundle/{{bundle.Identifier}}">{{bundle.SymbolicName}}</a>
              </div>
            </div>`
        },
        {
          field: 'ImportingBundles',
          displayName: 'Importing Bundles',
          cellTemplate: `
            <div class="ngCellText">
              <div ng-repeat="bundle in row.entity.ImportingBundles">
                <a title="Imported by bundle {{bundle.Identifier}}" ng-href="/osgi/bundle/{{bundle.Identifier}}">{{bundle.SymbolicName}}</a>
              </div>
            </div>`
        },
        {
          field: 'RemovalPending',
          displayName: 'Removal Pending',
        }
      ],
      primaryKeyFn: entity => entity.Name
    };


/*
    $scope.widget = new DataTable.TableWidget($scope, $templateCache, $compile, [
      <DataTable.TableColumnConfig> {
        "mDataProp": null,
        "sClass": "control center",
        "sDefaultContent": '<i class="fa fa-plus"></i>'
      },
      <DataTable.TableColumnConfig> { "mDataProp": "Name" },
      <DataTable.TableColumnConfig> { "mDataProp": "VersionLink" },
      <DataTable.TableColumnConfig> { "mDataProp": "RemovalPending" }

    ], {
      rowDetailTemplateId: 'packageBundlesTemplate',
      disableAddColumns: true
    });

*/
    $scope.$watch('workspace.selection', function() {
      updateTableContents();
    });

    function populateTable(response) {
      var packages = Osgi.defaultPackageValues(workspace, $scope, response.value);
      augmentPackagesInfo(packages);
    }

    function augmentPackagesInfo(packages) {
      var bundleMap = {};
      var createBundleMap = function(response) {
        angular.forEach(response.value, function(value, key) {
          var obj = {
            Identifier: value.Identifier,
            Name: "",
            SymbolicName: value.SymbolicName,
            State: value.State,
            Version: value.Version,
            LastModified: value.LastModified,
            Location: value.Location
          };
          if (value.Headers['Bundle-Name']) {
            obj.Name = value.Headers['Bundle-Name']['Value'];
          }
          bundleMap[obj.Identifier] = obj;
        });
        angular.forEach(packages, function(p, key) {
          angular.forEach(p["ExportingBundles"], function(b, key) {
            p["ExportingBundles"][key] = bundleMap[b];
          });
          angular.forEach(p["ImportingBundles"], function(b, key) {
            p["ImportingBundles"][key] = bundleMap[b];
          });
        });
        $scope.packages = packages;
        Core.$apply($scope);
       };
      workspace.jolokia.request({
            type: 'exec',
            mbean: getSelectionBundleMBean(workspace),
            operation: 'listBundles()'
          },
          {
            success: createBundleMap,
            error: createBundleMap
          });
    }

    function updateTableContents() {
      var mbean = getSelectionPackageMBean(workspace);
      if (mbean) {
        var jolokia = workspace.jolokia;
        // bundles first:
        jolokia.request({
              type: 'exec',
              mbean: mbean,
              operation: 'listPackages'
            },
            Core.onSuccess(populateTable));
      }
    }
  }]);
}
