/// <reference path="../../includes.ts"/>
/// <reference path="camelPlugin.ts"/>

module Camel {

  _module.controller("Camel.AttributesToolBarController", ["$scope", "workspace", "jolokia", ($scope, workspace:Workspace, jolokia) => {

    $scope.deleteDialog = false

    $scope.start = () => {
      $scope.invokeSelectedMBeans((item) => {
        return isState(item, "suspend") ? "resume()" :"start()";
      });
    };

    $scope.pause = () => {
      $scope.invokeSelectedMBeans("suspend()");
    };

    $scope.stop = () => {
      $scope.invokeSelectedMBeans("stop()", () => {
        // lets navigate to the parent folder!
        // as this will be going way
        workspace.removeAndSelectParentNode();
      });
    };

    /*
     * Only for routes!
     */
    $scope.delete = () => {
      $scope.invokeSelectedMBeans("remove()", () => {
        // force a reload of the tree
        $scope.workspace.operationCounter += 1;
        Core.$apply($scope);
      });
    };

    $scope.anySelectionHasState = (state) => {
      var selected = $scope.selectedItems || [];
      return selected.some((s) => isState(s, state));
    };

    $scope.everySelectionHasState = (state) => {
      var selected = $scope.selectedItems || [];
      return selected.every((s) => isState(s, state));
    };
  }]);
}
