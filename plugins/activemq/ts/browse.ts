/// <reference path="../../includes.ts"/>
/// <reference path="activemqHelpers.ts"/>
/// <reference path="activemqPlugin.ts"/>

module ActiveMQ {
  export var BrowseQueueController = _module.controller("ActiveMQ.BrowseQueueController", ["$scope", "workspace", "jolokia", "localStorage", '$location', "activeMQMessage", "$timeout", "$dialog", "$templateCache", ($scope, workspace:Workspace, jolokia, localStorage, location, activeMQMessage, $timeout, $dialog, $templateCache) => {

    $scope.searchText = '';
    $scope.workspace = workspace;

    $scope.allMessages = [];
    $scope.messages = [];
    $scope.headers = {};
    $scope.mode = 'text';

    $scope.gridOptions = {
      selectedItems: [],
      data: 'messages',
      displayFooter: false,
      showFilter: false,
      showColumnMenu: true,
      enableColumnResize: true,
      enableColumnReordering: true,
      enableHighlighting: true,
      filterOptions: {
        filterText: '',
        useExternalFilter: true
      },
      selectWithCheckboxOnly: true,
      showSelectionCheckbox: true,
      maintainColumnRatios: false,
      columnDefs: [
        {
          field: 'JMSMessageID',
          displayName: 'Message ID',
          cellTemplate: '<div class="ngCellText"><a href="" ng-click="row.entity.openMessageDialog(row)">{{row.entity.JMSMessageID}}</a></div>',
          // for ng-grid
          width: '34%'
          // for hawtio-datatable
          // width: "22em"
        },
        {
          field: 'JMSType',
          displayName: 'Type',
          width: '10%'
        },
        {
          field: 'JMSPriority',
          displayName: 'Priority',
          width: '7%'
        },
        {
          field: 'JMSTimestamp',
          displayName: 'Timestamp',
          width: '19%'
        },
        {
          field: 'JMSExpiration',
          displayName: 'Expires',
          width: '10%'
        },
        {
          field: 'JMSReplyTo',
          displayName: 'Reply To',
          width: '10%'
        },
        {
          field: 'JMSCorrelationID',
          displayName: 'Correlation ID',
          width: '10%'
        }
      ],
      primaryKeyFn: entity => entity.JMSMessageID
    };

    $scope.showMessageDetails = false;

    // openMessageDialog is for the dialog itself so we should skip that guy
    var ignoreColumns = ["PropertiesText", "BodyPreview", "Text", "openMessageDialog"];
    var flattenColumns = ["BooleanProperties", "ByteProperties", "ShortProperties", "IntProperties", "LongProperties", "FloatProperties",
      "DoubleProperties", "StringProperties"];

    $scope.$watch('workspace.selection', function () {
      if (workspace.moveIfViewInvalid()) {
        return;
      }

      // lets defer execution as we may not have the selection just yet
      setTimeout(loadTable, 50);
    });

    $scope.$watch('gridOptions.filterOptions.filterText', (filterText) => {
      filterMessages(filterText);
    });

    $scope.openMessageDialog = (message) => {
      ActiveMQ.selectCurrentMessage(message, "JMSMessageID", $scope);
      if ($scope.row) {
        $scope.mode = CodeEditor.detectTextFormat($scope.row.Text);
        $scope.showMessageDetails = true;
      }
    };

    $scope.refresh = loadTable;

    ActiveMQ.decorate($scope);

    $scope.moveMessages = () => {
        var selection = workspace.selection;
        var mbean = selection.objectName;
        if (!mbean || !selection) {
          return;
        }
        var selectedItems = $scope.gridOptions.selectedItems;
        $dialog.dialog({
          resolve: {
            selectedItems: () => selectedItems,
            gridOptions: () => $scope.gridOptions,
            queueNames: () => $scope.queueNames,
            parent: () => $scope
          },
          template: $templateCache.get("activemqMoveMessageDialog.html"),
          controller: ["$scope", "dialog", "selectedItems", "gridOptions", "queueNames", "parent", ($scope, dialog, selectedItems, gridOptions, queueNames, parent) => {
            $scope.selectedItems = selectedItems;
            $scope.gridOptions = gridOptions;
            $scope.queueNames = queueNames;
            $scope.queueName = '';
            $scope.close = (result) => {
              dialog.close();
              if (result) {
                parent.message = "Moved " + Core.maybePlural(selectedItems.length, "message") + " to " + $scope.queueName;
                var operation = "moveMessageTo(java.lang.String, java.lang.String)";
                angular.forEach(selectedItems, (item, idx) => {
                  var id = item.JMSMessageID;
                  if (id) {
                    var callback = (idx + 1 < selectedItems.length) ? intermediateResult : moveSuccess;
                    jolokia.execute(mbean, operation, id, $scope.queueName, Core.onSuccess(callback));
                  }
                });
              }
            }
          }]
        }).open();

    };

    $scope.resendMessage = () => {
        var selection = workspace.selection;
        var mbean = selection.objectName;
        if (mbean && selection) {
            var selectedItems = $scope.gridOptions.selectedItems;
            //always assume a single message
            activeMQMessage.message = selectedItems[0];
            location.path('activemq/sendMessage');
        }
    };

    $scope.deleteMessages = () => {
      var selection = workspace.selection;
      var mbean = selection.objectName;
      if (!mbean || !selection) {
        return;
      }
      var selected = $scope.gridOptions.selectedItems;
      if (!selected || selected.length === 0) {
        return;
      }
      UI.multiItemConfirmActionDialog(<UI.MultiItemConfirmActionOptions> {
        collection: selected,
        index: 'JMSMessageID',
        onClose: (result:boolean) => {
          if (result) {
            $scope.message = "Deleted " + Core.maybePlural(selected.length, "message");
            var operation = "removeMessage(java.lang.String)";
            _.forEach(selected, (item:any, idx) => {
              var id = item.JMSMessageID;
              if (id) {
                var callback = (idx + 1 < selected.length) ? intermediateResult : operationSuccess;
                jolokia.execute(mbean, operation, id, Core.onSuccess(callback));
              }
            });
          }
        },
        title: 'Delete messages?',
        action: 'The following messages will be deleted:',
        okText: 'Delete',
        okClass: 'btn-danger',
        custom: "This operation is permanent once completed!",
        customClass: "alert alert-warning"
      }).open();
    };

    $scope.retryMessages = () => {
      var selection = workspace.selection;
      var mbean = selection.objectName;
      if (mbean && selection) {
        var selectedItems = $scope.gridOptions.selectedItems;
        $scope.message = "Retry " + Core.maybePlural(selectedItems.length, "message");
        var operation = "retryMessage(java.lang.String)";
        angular.forEach(selectedItems, (item, idx) => {
          var id = item.JMSMessageID;
          if (id) {
            var callback = (idx + 1 < selectedItems.length) ? intermediateResult : operationSuccess;
            jolokia.execute(mbean, operation, id, Core.onSuccess(callback));
          }
        });
      }
    };

    $scope.queueNames = (completionText) => {
      var queuesFolder = getSelectionQueuesFolder(workspace);
      return (queuesFolder) ? queuesFolder.children.map(n => n.title) : [];
    };


    function populateTable(response) {
      var data = response.value;
      if (!angular.isArray(data)) {
        $scope.allMessages = [];
        angular.forEach(data, (value, idx) => {
          $scope.allMessages.push(value);
        });
      } else {
        $scope.allMessages = data;
      }
      angular.forEach($scope.allMessages, (message) => {
        message.openMessageDialog = $scope.openMessageDialog;
        message.headerHtml = createHeaderHtml(message);
        message.bodyText = createBodyText(message);
      });
      filterMessages($scope.gridOptions.filterOptions.filterText);
      Core.$apply($scope);
    }

    /*
     * For some reason using ng-repeat in the modal dialog doesn't work so lets
     * just create the HTML in code :)
     */
    function createBodyText(message) {
      if (message.Text) {
        var body = message.Text;
        var lenTxt = "" + body.length;
        message.textMode = "text (" + lenTxt + " chars)";
        return body;
      } else if (message.BodyPreview) {
        var code = Core.parseIntValue(localStorage["activemqBrowseBytesMessages"] || "1", "browse bytes messages");
        var body;

        message.textMode = "bytes (turned off)";
        if (code != 99) {
          var bytesArr = [];
          var textArr = [];
          message.BodyPreview.forEach(b => {
            if (code === 1 || code === 2) {
              // text
              textArr.push(String.fromCharCode(b));
            }
            if (code === 1 || code === 4) {
              // hex and must be 2 digit so they space out evenly
              var s = b.toString(16);
              if (s.length === 1) {
                s = "0" + s;
              }
              bytesArr.push(s);
            } else {
              // just show as is without spacing out, as that is usually more used for hex than decimal
              var s = b.toString(10);
              bytesArr.push(s);
            }
          });

          var bytesData = bytesArr.join(" ");
          var textData = textArr.join("");

          if (code === 1 || code === 2) {
            // bytes and text
            var len = message.BodyPreview.length;
            var lenTxt = "" + textArr.length;
            body = "bytes:\n" + bytesData + "\n\ntext:\n" + textData;
            message.textMode = "bytes (" + len + " bytes) and text (" + lenTxt + " chars)";
          } else {
            // bytes only
            var len = message.BodyPreview.length;
            body = bytesData;
            message.textMode = "bytes (" + len + " bytes)";
          }
        }
        return body;
      } else {
        message.textMode = "unsupported";
        return "Unsupported message body type which cannot be displayed by hawtio";
      }
    }

    /*
     * For some reason using ng-repeat in the modal dialog doesn't work so lets
     * just create the HTML in code :)
     */
    function createHeaderHtml(message) {
      var headers = createHeaders(message);
      var properties = createProperties(message);
      var headerKeys = _.keys(headers);

      function sort(a, b) {
        if (a > b) return 1;
        if (a < b) return -1;
        return 0;
      }

      var propertiesKeys = _.keys(properties).sort(sort);
      var jmsHeaders = _.filter(headerKeys, (key) => _.startsWith(key, "JMS")).sort(sort);
      var remaining = _.difference(headerKeys, jmsHeaders.concat(propertiesKeys)).sort(sort);

      var buffer = [];

      function appendHeader(key) {
        var value = headers[key];
        if (value === null) {
          value = '';
        }
        buffer.push('<tr><td class="propertyName"><span class="green">Header</span> - ' +
            key +
            '</td><td class="property-value">' +
            value +
            '</td></tr>');
      }

      function appendProperty(key) {
        var value = properties[key];
        if (value === null) {
          value = '';
        }
        buffer.push('<tr><td class="propertyName">' +
            key +
            '</td><td class="property-value">' +
            value +
            '</td></tr>');
      }

      jmsHeaders.forEach(appendHeader);
      remaining.forEach(appendHeader);
      propertiesKeys.forEach(appendProperty);
      return buffer.join("\n");
    }

    function createHeaders(row) {
      //log.debug("headers: ", row);
      var answer = {};
      angular.forEach(row, (value, key) => {
        if (!_.some(ignoreColumns, (k) => k === key) && !_.some(flattenColumns, (k) => k === key)) {
            answer[_.escape(key)] = _.escape(value);
        }
      });
      return answer;
    }
    
    function createProperties(row) {
      //log.debug("properties: ", row);
      var answer = {};
      angular.forEach(row, (value, key) => {
        if (!_.some(ignoreColumns, (k) => k === key) && _.some(flattenColumns, (k) => k === key)) {
          angular.forEach(value, (v2, k2) => {
            answer['<span class="green">' + key.replace('Properties', ' Property') + '</span> - ' + _.escape(k2)] = _.escape(v2)
          });
        }
      });
      return answer;
    }

    function loadTable() {
      var objName;

      if(workspace.selection){
        objName = workspace.selection.objectName;
      } else{
        // in case of refresh
        var key = location.search()['nid'];
        var node = workspace.keyToNodeMap[key];
        objName = node.objectName;
      }

      if (objName) {
        $scope.dlq = false;
        jolokia.getAttribute(objName, "DLQ", Core.onSuccess(onDlq, {silent: true}));
        jolokia.request(
          {type: 'exec', mbean: objName, operation: 'browse()'},
          Core.onSuccess(populateTable));
      }
    }


    function onDlq(response) {
      $scope.dlq = response;
      Core.$apply($scope);
    }

    function intermediateResult() {
    }

    function operationSuccess() {
      $scope.gridOptions.selectedItems.splice(0);
      Core.notification("success", $scope.message);
      setTimeout(loadTable, 50);
    }

    function moveSuccess() {
        operationSuccess();
        workspace.loadTree();
    }

    function filterMessages(filter) {
      var searchConditions = buildSearchConditions(filter);
      evalFilter(searchConditions);
    }

    function evalFilter(searchConditions) {
      if (!searchConditions || searchConditions.length === 0) {
        $scope.messages = $scope.allMessages;
      } else {
        log.debug("Filtering conditions:", searchConditions);
        $scope.messages = $scope.allMessages.filter((message) => {
          log.debug("Message:", message);

          var matched = true;

          $.each(searchConditions, (index, condition) => {
            if (!condition.column) {
              matched = matched && evalMessage(message, condition.regex);
            } else {
              matched = matched &&
                        (message[condition.column] && condition.regex.test(message[condition.column])) ||
                        (message.StringProperties && message.StringProperties[condition.column] && condition.regex.test(message.StringProperties[condition.column]));
            }
          });

          return matched;
        });
      }
    }

    function evalMessage(message, regex) {
      var jmsHeaders = ['JMSDestination', 'JMSDeliveryMode', 'JMSExpiration', 'JMSPriority', 'JMSMessageID', 'JMSTimestamp', 'JMSCorrelationID', 'JMSReplyTo', 'JMSType', 'JMSRedelivered'];
      for(var i = 0; i < jmsHeaders.length; i++) {
        var header = jmsHeaders[i];
        if (message[header] && regex.test(message[header])) {
          return true;
        }
      }

      if (message.StringProperties) {
        for (var property in message.StringProperties) {
          if (regex.test(message.StringProperties[property])) {
            return true;
          }
        }
      }

      if (message.bodyText && regex.test(message.bodyText)) {
        return true;
      }

      return false;
    }

    function getRegExp(str, modifiers) {
      try {
        return new RegExp(str, modifiers);
      } catch (err) {
        return new RegExp(str.replace(/(\^|\$|\(|\)|<|>|\[|\]|\{|\}|\\|\||\.|\*|\+|\?)/g, '\\$1'));
      }
    }

    function buildSearchConditions(filterText) {
      var searchConditions = [];
      var qStr;
      if (!(qStr = $.trim(filterText))) {
        return;
      }
      var columnFilters = qStr.split(";");
      for (var i = 0; i < columnFilters.length; i++) {
        var args = columnFilters[i].split(':');
        if (args.length > 1) {
          var columnName = $.trim(args[0]);
          var columnValue = $.trim(args[1]);
          if (columnName && columnValue) {
            searchConditions.push({
              column: columnName,
              columnDisplay: columnName.replace(/\s+/g, '').toLowerCase(),
              regex: getRegExp(columnValue, 'i')
            });
          }
        } else {
          var val = $.trim(args[0]);
          if (val) {
            searchConditions.push({
              column: '',
              regex: getRegExp(val, 'i')
            });
          }
        }
      }
      return searchConditions;
    }

  }]);
}
