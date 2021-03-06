/**
 * workshopController.js - LearnSQL
 *
 * Christopher Innaco, Michael Torres
 * Web Applications and Databases for Education (WADE)
 *
 * This file contains the AngularJS controller used for students to send queries
 *  to class database for which they have access
 */

/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */

app.controller('workshopCtrl', ($scope, $http, $location) => {
  function printToCommandHistory(input) {
    $scope.commandHistory += input;
  }
  function nextCommandPrompt(numNewLines) {
    printToCommandHistory(`${'\n'.repeat(numNewLines)}${$scope.classID}=> `);
  }

  $scope.initClasses = () => {
    $http.get('/workshop/getClasses')
      .success((data) => {
        data.forEach((element) => {
          element.classname = element.classname.toUpperCase();
        });

        $scope.classes = data;
      });
  };

  $scope.initClass = () => {
    // Set the submit button text
    $scope.submitQuery_Button = 'Run Code';

    $scope.SQL_Button = 'SQL';
    $scope.PLpgSQL_Button = 'PL/pgSQL';

    // Set the default language
    $scope.language = 'SQL';

    /**
     * Get the classID to create the connection string to send queries
     *  to the class's database
     */
    $scope.classID = $location.search().class;

    // Clear the command history box to append query results to
    $scope.commandHistory = '';
    $scope.clearHistory();

    /**
     * Get the className from the classID using the '_' as a delimiter,
     *  then make uppercase
     */
    $scope.className = ($scope.classID.substr(0, $scope.classID.search('_'))).toUpperCase();
  };

  $scope.formatQuery = () => {
    // Check if the user entered a query
    if (typeof $scope.userQuery === 'undefined' || $scope.userQuery === '') {
      printToCommandHistory('\n No query was entered. Try again.');
      nextCommandPrompt(2);
      $scope.submitQuery_Button = 'Run Code';
      return;
    }

    // Check if the query is SQL or PL/pgSQL
    if ($scope.language === 'SQL') {
      // Array of the user input queries delimited by ';'
      const userQueries = $scope.userQuery.split(';');

      // Send queries one at a time to be processed
      for (const i in userQueries) {
        if (Object.prototype.hasOwnProperty.call(userQueries, i)) {
          // Remove newlines, tabs and other line breaks
          userQueries[i] = userQueries[i].replace(/(\r\n\t|\n|\r\t)/gm, ' ');

          if (userQueries[i] !== '') {
            $scope.sendQuery(userQueries[i]);
          }
        }
      }
    } else {
      // If the language uses procedural extensions, do not use semicolons to delimit
      const userQuery = String($scope.userQuery);

      if (userQuery !== '') {
        $scope.sendQuery(userQuery);
      }
    }
  };

  $scope.sendQuery = (inputQuery) => {
    let formattedAttributes = [];
    // --- Function declarations ---
    function findAttributeLength(queryResult) {
      const attributeCharLength = [];

      // Find the length of the characters for each attribute
      for (let i = 0; i < Object.keys(queryResult).length; i += 1) {
        attributeCharLength[i] = (Object.keys(queryResult)[i]).length;
      }

      return attributeCharLength;
    }

    function storeColumnWidth(queryResult) {
      const resultCharLength = [];

      // Get the lengths of each string in the result set
      for (let i = 0; i < Object.keys(queryResult).length; i += 1) {
        /**
         * Get the string representation of the element using Object.keys, which will
         *  use the property name to reference the element. This method is used because
         *  using an integer to access an object's elements causes unwanted behavior
         *  with named indices.
         */
        const currentResultString = String(queryResult[Object.keys(queryResult)[i]]);

        resultCharLength[i] = currentResultString.length;
      }
      return resultCharLength;
    }

    function compareWidths(resultCharLength) {
      const resultCharLengthParsed = [];

      // Store the largest string length in the first array of arrays
      for (let i = 0; i < Object.keys(resultCharLength).length; i += 1) {
        const subArray = resultCharLength[i];
        for (let j = 0; j < Object.keys(subArray).length; j += 1) {
          const columnWidth = [];
          for (let k = 0; k < Object.keys(resultCharLength).length; k += 1) {
            // Find the max width by comparing rows in the same column
            columnWidth.push(resultCharLength[k][j]);
          }
          resultCharLengthParsed.push(Math.max(...columnWidth));
        }
        break;
      }
      return resultCharLengthParsed;
    }

    function setColumnWidth(queryResult, attributeCharLength, resultCharLength) {
      // Array to store the formatted (padded) attribute headers
      const formattedAttributesLocal = Object.keys(queryResult);

      // Determine the size of each column by comparing the arrays
      for (let i = 0; i < Object.keys(queryResult).length; i += 1) {
        /**
         * Pad the end of the column with spaces to match the length of the
         * attribute it corresponds with
         */
        if (attributeCharLength[i] > resultCharLength[i]) {
          const currentResultString = String(queryResult[Object.keys(queryResult)[i]]);
          // eslint-disable-next-line max-len
          queryResult[Object.keys(queryResult)[i]] = currentResultString.padEnd(Number(attributeCharLength[i]));
        } else {
          /**
           * If the attribute string is shorter, pad the end using the length
           *  of the longest string in the column
           */
          const currentResultString = String(queryResult[Object.keys(queryResult)[i]]);
          // eslint-disable-next-line max-len
          queryResult[Object.keys(queryResult)[i]] = currentResultString.padEnd(Number(resultCharLength[i]));

          const currentAttributeString = String(formattedAttributesLocal[i]);
          formattedAttributesLocal[i] = currentAttributeString.padEnd(Number(resultCharLength[i]));
        }
      }

      return formattedAttributesLocal;
    }

    function formatSeparatorRow(fromAttributeLength, queryResult) {
      // Array to store the row which visually separates the attributes from the result rows
      const separatorRow = [];

      for (let i = 0; i < Object.keys(queryResult).length; i += 1) {
        // Set the formatting for the separator row using `psql` style
        // separatorRow[i] = '-' + '-'.repeat(String(fromAttributeLength[i]).length) + '-+';
        separatorRow[i] = `-${'-'.repeat(String(fromAttributeLength[i]).length)}-+`;
      }
      return separatorRow;
    }

    function printHeader(queryResult, inputFormattedAttributes, separatorRow) {
      // Print the attributes of the query results
      for (let i = 0; i < Object.keys(queryResult).length; i += 1) {
        printToCommandHistory(` | ${inputFormattedAttributes[i]}`);
      }

      printToCommandHistory(` | ${'\n'} +`);

      // Print the separator row
      for (let i = 0; i < separatorRow.length; i += 1) {
        printToCommandHistory(separatorRow[i]);
      }
    }

    function printRow(queryResult) {
      // Print the rows of the query results
      // eslint-disable-next-line no-restricted-syntax
      for (const i in queryResult) {
        if (Object.prototype.hasOwnProperty.call(queryResult, i)) {
          printToCommandHistory(` | ${queryResult[i]}`);
        }
      }

      printToCommandHistory(' | ');
    }
    // --- End Function declarations ---

    $scope.submitQuery_Button = 'Running Query . . .';

    $scope.queryInfo = {
      userQuery: inputQuery,
      classID: $scope.classID,
    };

    $http.post('/workshop/sendQuery', $scope.queryInfo)
      .success((data) => {
        // If the entered query produced successful results, but has no return value
        if (!Array.isArray(data) || !data.length) {
          printToCommandHistory(`${inputQuery}\n`);
          printToCommandHistory('\n Operation completed successfully (No returned rows)');
          nextCommandPrompt(2);
          return;
        }

        printToCommandHistory(`${inputQuery}\n`);

        let queryResult = data;

        const attributeCharLength = findAttributeLength(queryResult[0]);

        let resultCharLength = [];

        // For each result row, find the length of each string
        for (const i in data) {
          if (Object.prototype.hasOwnProperty.call(data, i)) {
            queryResult = data[i];
            resultCharLength[i] = storeColumnWidth(queryResult);
          }
        }

        // Find the longest string in each column and store in an array
        resultCharLength = compareWidths(resultCharLength);

        /**
         * Compare the length of the longest result string to the length of the attribute,
         *  then set the column width to the larger of the two values
         */
        for (const i in data) {
          if (Object.prototype.hasOwnProperty.call(data, i)) {
            queryResult = data[i];
            // eslint-disable-next-line max-len
            formattedAttributes = setColumnWidth(queryResult, attributeCharLength, resultCharLength);
          }
        }

        /**
         * Format the `psql`-style separator row to visually divide attributes from results
         *  based on the determined column widths
         */
        const separatorRow = formatSeparatorRow(formattedAttributes, queryResult);

        // Print the formatted attributes and separator row
        printHeader(queryResult, formattedAttributes, separatorRow);

        // Print the formatted query results
        for (const i in data) {
          if (Object.prototype.hasOwnProperty.call(data, i)) {
            queryResult = data[i];
            printToCommandHistory('\n');
            printRow(queryResult);
          }
        }

        nextCommandPrompt(2);
      })

      .error((error) => {
        printToCommandHistory(`${inputQuery}\n`);
        printToCommandHistory(`\nError: ${error.status}`);
        nextCommandPrompt(2);
      });
    $scope.submitQuery_Button = 'Run Code';
  };

  $scope.currentLanguage = (inputLanguage) => {
    $scope.language = inputLanguage;
    printToCommandHistory(` Selected language: ${$scope.language}\n`);
    nextCommandPrompt(0);
  };

  $scope.clearHistory = () => {
    $scope.commandHistory = `${$scope.classID}=> `;
  };

  $scope.clearQueries = () => {
    $scope.userQuery = '';
  };

  $scope.closeConnection = () => {
    $http.post('/workshop/closeConnection');
  };
});

/**
 * Upon page navigation, inform the user that queries and command history
 *  will be lost. Additionally, close the connection pool to the database.
 */

// eslint-disable-next-line no-unused-vars
function closeConnection() {
  const scope = angular.element('[ng-controller=workshopCtrl]').scope();
  scope.$apply(() => {
    scope.closeConnection();
  });
  return 'All unsaved queries and command history will be lost.';
}
