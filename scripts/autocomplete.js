// TeXworksScript
// Title: Context aware autocomplete
// Description: Autocompletion inspired by vim.
// Author: Henrik Skov Midtiby
// Version: 0.3
// Date: 2011-05-16
// Script-Type: standalone
// Context: TeXDocument
// Shortcut: Ctrl+M

function autocomplete()
{
	var locationInformation = collectDetailsAboutTheCurrentSelection();
	//showObject(locationInformation);

	// If first in a line, complete unfinished environment.
	if(locationInformation.firstPlaceInLine)
	{
		closeEnvironment(locationInformation.unclosedEnvironment);
		return;
	}

	// If in primary argument to input, include, includegraphics or similar, 
	// complete filename.
	if(shouldCompleteFilename(locationInformation.commandName)) {
		var words = locateMatchingFilenames(locationInformation.extractedWord);
	} else if(locationInformation.wordToComplete.length == 0) {
			return;
	} else if (locationInformation.isCommandName) {
		var words = locateMatchingCommandNames(locationInformation.extractedWord);
	} else {
		var words = locateMatchingWordsAwareOfContext(locationInformation.commandName, locationInformation.extractedWord);
	}
	
	// Sort the found matches to avoid problems when the ordering is changed 
	// due to the current suggested completion.
	words = words.sort();

	insertSuggestion(words, locationInformation);
}
function collectDetailsAboutTheCurrentSelection()
{
	var details = {};
	var selectedWord = locateWordEndingOnCursor();
	details.wordToComplete = selectedWord.extractedWord;
	details.selectedText = TW.target.selection;
	details.lastGuess = selectedWord.lastGuess;
	details.commandName = selectedWord.commandName;
	details.extractedWord = selectedWord.extractedWord;
	details.lastGuess = selectedWord.lastGuess;
	details.wordStart = selectedWord.wordStart;
	details.isCommandName = selectedWord.isCommandName;

	var unclosed = locateUnclosedEnvironmentsBeforeCursor();
	details.unclosedEnvironment = unclosed;

	details.firstPlaceInLine = false;
	if(TW.target.text.charAt(TW.target.selectionStart - 1) == '\n')
	{
		details.firstPlaceInLine = true;
	}

	return(details);
}
function closeEnvironment(unclosedEnvironment)
{
	if(unclosedEnvironment != "")
	{
		TW.target.insertText("\\end{" + unclosedEnvironment + "}\n");
	}
}
function shouldCompleteFilename(commandName)
{
	if(commandName == "includegraphics")
		return true;
	if(commandName == "input")
		return true;
	if(commandName == "include")
		return true;
	return false;
}
function locateMatchingFilenames(extractedWord)
{
	var currentDirectory = getPathFromFilename(TW.target.fileName);
	var localPath = getPathFromFilename(extractedWord);
	var filenamesInDirectory = getListOfFilesInDir(currentDirectory + "/" + localPath);
	var words = getMatchingFilenames(filenamesInDirectory, localPath, extractedWord, []);
	return words;
}
function locateMatchingCommandNames(extractedWord)
{
	var words = [];
	// Command list taken from http://en.wikibooks.org/wiki/LaTeX/Command_Glossary
	var listOfCommands = "addcontentsline addtocontents addtocounter address addtolength addvspace alph appendix arabic author backslash baselineskip baselinestretch bf bibitem bigskipamount bigskip boldmath cal caption cdots centering chapter circle cite cleardoublepage clearpage cline closing color copyright dashbox date ddots documentclass dotfill em emph ensuremath euro fbox flushbottom fnsymbol footnote footnotemark footnotesize footnotetext frac frame framebox frenchspacing hfill hline hrulefill hspace huge Huge hyphenation include includegraphics includeonly indent input it item kill label large Large LARGE LaTeX LaTeXe ldots left lefteqn line linebreak linethickness linewidth listoffigures listoftables location makebox maketitle markboth markright mathcal mathop mbox medskip multicolumn multiput newcommand newcounter newenvironment newfont newlength newline newpage newsavebox newtheorem nocite noindent nolinebreak nonfrenchspacing normalsize nopagebreak not onecolumn opening oval overbrace overline pagebreak pagenumbering pageref pagestyle par paragraph parbox parindent parskip part protect providecommand put raggedbottom raggedleft raggedright raisebox ref renewcommand right rm roman rule savebox sbox sc scriptsize section setcounter setlength settowidth sf shortstack signature sl slash small smallskip sout space sqrt stackrel subparagraph subsection subsubsection tableofcontents telephone TeX textbf textcolor textit textmd textnormal textrm textsc textsf textsl texttt textup textwidth textheight thanks thispagestyle tiny title today tt twocolumn typeout typein uline underbrace underline unitlength usebox usecounter uwave value vbox vdots vector verb vfill vline vphantom vspace"; 
	words = locateMatchingWordsInString(extractedWord, listOfCommands, words);
	return words;
}
function locateMatchingWordsAwareOfContext(commandName, extractedWord)
{
	var matchingCommands = determineMatchingCommandsFromCurrentCommand(commandName);
	var words = locateMatchingWords(extractedWord, matchingCommands);
	return words;
}
function insertSuggestion(words, locationInformation)
{
	var CommonSequence = determineLongestCommonInitialSequence(words);
	var CommonStringInAllMatchingWords = getEndOfCommonSubstring(CommonSequence, locationInformation.extractedWord);

	// Insert remaining part of the common substring
	TW.target.insertText(CommonStringInAllMatchingWords);

	var NextGuess = determineNextGuess(words, locationInformation.lastGuess);

	TW.target.insertText(NextGuess.substr(CommonSequence.length, NextGuess.length));
	TW.target.selectRange(locationInformation.wordStart + CommonSequence.length, max(0, NextGuess.length - CommonSequence.length));
}
// Function that extracts the longest alphanumeric string ending 
// on the current cursor location.
// In addition is it determined if the word is a parameter to a command, in
// this case is the command name returned.
function locateWordEndingOnCursor()
{
	// Locate word ending at cursor location.
	var wordStart = TW.target.selectionStart;
	var wordEnd = TW.target.selectionStart;

	while(isAlphaNumeric(TW.target.text.charAt(wordStart - 1)))
	{
		wordStart = wordStart - 1;
	}

	var extractedWord = TW.target.text.substr(wordStart, wordEnd - wordStart);
	var markedWord = TW.target.selection;
	var lastGuess = extractedWord + markedWord;
	var commandName = getCommandName(wordStart);
	var isCommandName = false;
	if(wordStart > 0)
	{
		var charBeforeWord = TW.target.text.substring(wordStart - 1, wordStart);
		if(charBeforeWord == "\\")
		{
			isCommandName = true;
		}
	}

	return {wordStart: wordStart, extractedWord: extractedWord, lastGuess: lastGuess, commandName: commandName, isCommandName: isCommandName};
}
function getCommandName(wordStart)
{
	// Determine if the word is a parameter to a command
	var counter = 100;
	var commandName = "commandNameNothing";
	while(counter > 0 && isAlphaNumericKommaOrSpace(TW.target.text.charAt(wordStart - 1)))
	{
		wordStart = wordStart - 1;
		counter = counter - 1;
		commandName = "commandNameSomething";
	}
	if(TW.target.text.charAt(wordStart - 1) == "{")
	{
		wordStart = wordStart - 1;
		// If optional arguments are given to the current command ignore these.
		if(TW.target.text.charAt(wordStart - 1) == "]")
		{
			while(counter > 0 && TW.target.text.charAt(wordStart - 1) != "[")
			{
				wordStart = wordStart - 1;
				counter = counter - 1;
			}
			wordStart = wordStart - 1;
		}

		commandName = "commandNameMore";
		var commandEnd = wordStart;
		var commandStart = wordStart;
		while(counter > 0 && isAlphaNumeric(TW.target.text.charAt(commandStart - 1))) 
		{
			commandName = commandName + counter;
			commandStart = commandStart - 1;
			counter = counter - 1;
		}
		if(TW.target.text.charAt(commandStart - 1) == '\\')
		{
			commandName = TW.target.text.substr(commandStart, commandEnd - commandStart);
		}
	}

	return(commandName);
}
function locateUnclosedEnvironmentsBeforeCursor()
{
	var textBeforeCursor = TW.target.text.substr(0, TW.target.selectionStart);
	var listOfBeginEnvironments = [];
	var listOfEndEnvironments = [];
	var environmentStack = [];
	var remainingTextToAnalyze = textBeforeCursor;
	var tempBeginIndex = remainingTextToAnalyze.lastIndexOf("\\begin{");
	var tempEndIndex = remainingTextToAnalyze.lastIndexOf("\\end{");
	var unclosedEnvironment = "";

	//environmentStack.push(remainingTextToAnalyze.length)
	while(tempBeginIndex != -1 || tempEndIndex != -1)
	{
		if(tempBeginIndex > tempEndIndex)
		{
			var tempText = remainingTextToAnalyze.substr(tempBeginIndex + 7, 40);
			var tempIndex = tempText.indexOf("}");
			var envName = remainingTextToAnalyze.substr(tempBeginIndex + 7, tempIndex);

			var topOfStack = environmentStack[environmentStack.length - 1];
			if(topOfStack == "e:" + envName)
			{
				var len = environmentStack.length;
				environmentStack = environmentStack.slice(0, len - 1);
			}
			else
			{
				unclosedEnvironment = envName;
				break;
			}
			remainingTextToAnalyze = remainingTextToAnalyze.substr(0, tempBeginIndex);
			tempBeginIndex = remainingTextToAnalyze.lastIndexOf("\\begin{");
		}
		else
		{
			var tempText = remainingTextToAnalyze.substr(tempEndIndex + 5, 40);
			var tempIndex = tempText.indexOf("}");
			var envName = remainingTextToAnalyze.substr(tempEndIndex + 5, tempIndex);
			environmentStack.push("e:" + envName);
			remainingTextToAnalyze = remainingTextToAnalyze.substr(0, tempEndIndex);
			tempEndIndex = remainingTextToAnalyze.lastIndexOf("\\end{");
		}
	}

	//showObject(unclosedEnvironment);

	return(unclosedEnvironment);
}
function isAlphaNumeric(character)
{
	if('a' <= character && character <= 'z') {
		return(true); }
	if('A' <= character && character <= 'Z') {
		return(true); }
	if('0' <= character && character <= '9') {
		return(true); }
	if('/' == character) {
		return(true); }
	if('.' == character) {
		return(true); }
	return(false);
}
function isAlphaNumericKommaOrSpace(character)
{
	// Check for alpha numeric values
	if('a' <= character && character <= 'z') {
		return(true); }
	if('A' <= character && character <= 'Z') {
		return(true); }
	if('0' <= character && character <= '9') {
		return(true); }
	// Check for komma
	if(',' == character) {
		return(true); }
	// Check for space and tabulator
	if(' ' == character) {
		return(true); }
	if('\t' == character) {
		return(true); }
	if('/' == character) {
		return(true); }
	if('.' == character) {
		return(true); }
	return(false);
}
function getPathFromFilename(filename)
{
	// Locate the last directory separator
	var counter = 0;
	var lastDirectorySeparator = -1;
	while(counter < filename.length)
	{
		if(filename.charAt(counter) == '/')
		{
			lastDirectorySeparator = counter;
			//TW.information(null, "Val", filename.charAt(counter));
		}
		counter += 1;
	}
	//TW.information(null, "Counter:", "Counter: " + counter + " filename.length: " + filename.length);
	var basepath = filename.substr(0, lastDirectorySeparator);
	return basepath;
}
function getListOfFilesInDir(directory)
{
	if (TW.platform() == 'Windows')
	{
		var retVal = TW.system("cmd /c dir /b \"" + directory.replace(/\//g,"\\") +"\"", true);
	}
	else
	{
		var retVal = TW.system("ls " + directory, true);
	}

	if(retVal.output == undefined)
	{
		TW.information(null, "Error message", retVal.message);
	}

	return retVal.output;
}
function getMatchingFilenames(filenamesInDirectory, localPath, extractedWord, words)
{
	var typeOfLineBreak = getTypeOfLineBreak(filenamesInDirectory);
	while(filenamesInDirectory.indexOf(typeOfLineBreak) > -1)
	{
		var index = filenamesInDirectory.indexOf('\n');
		var tempWord = filenamesInDirectory.substr(0, index);
		if(localPath != "")
		{
			tempWord = localPath + "/" + tempWord;
		}
		filenamesInDirectory = filenamesInDirectory.substr(index + 1, filenamesInDirectory.length - index)

		if(tempWord.indexOf(extractedWord) == 0)
		{
			// Remove whitespaces in the word
			words.push(tempWord.replace(/\s/, ""));
		}
	}
	if(words.length > 0)
	{
		words = unique(words);
	}
	else
	{
		words.push(extractedWord);
	}
	return(words);
}
function getTypeOfLineBreak(sample) 
{
	if (sample.indexOf("\r\n") > -1)
	{
		return("\r\n");
	}
	return("\n");
}
// Function for removing dublicate element in an array.
// Code from http://www.martienus.com/code/javascript-remove-duplicates-from-array.html
function unique(a)
{
	var r = new Array();
	o:for(var i = 0, n = a.length; i < n; i++)
	{
		for(var x = 0, y = r.length; x < y; x++)
		{
			if(r[x]==a[i]) continue o;
		}
		r[r.length] = a[i];
	}
	return r;
}
function determineMatchingCommandsFromCurrentCommand(currentCommand)
{
	if(isElementInList(["ref", "pageref"], currentCommand))
	{
		return(["label", "ref", "pageref"]);
	}
	if(isElementInList(["label"], currentCommand))
	{
		return(["pageref", "ref"]);
	}
	if(isElementInList(["cite", "citep", "citet"], currentCommand))
	{
		return(["cite", "citep", "citet"]);
	}
	return([]);
}
function isElementInList(list, element)
{
	tempIndex = list.indexOf(element);
	return(tempIndex > -1);
}
function locateMatchingWords(wordToMatch, commands)
{
	var words = [];
	// Only look for matches if the wordToMatch is nonempty.
	if(wordToMatch.length > 0)
	{
		fullText = getTextFromAllOpenWindows();
		if(commands.length == 0)
		{
			// No command names were specified
			words = locateMatchingWordsInString(wordToMatch, fullText, words);
		}
		else
		{
			// One or more command names were specified.
			// Only search for matching words within parameters to these commands.
			for(idx1 = 0; idx1 < commands.length; idx1++)
			{
				var Command = commands[idx1];
				var RegExpString = "\\\\" + Command + "{([^}]*)}";
				var CommandParameters = new RegExp(RegExpString, "g");
				var labelsList = fullText.match(CommandParameters);
				if(labelsList)
				{
					for(idx = 0; idx < labelsList.length; idx++)
					{
						var parameterText = labelsList[idx];
						words = locateMatchingWordsInString(wordToMatch, parameterText, words);
					}
				}
			}
		}
	}
	return(wordsCleanUp(words, wordToMatch));
}
function getTextFromAllOpenWindows()
{
	var windows = TW.app.getOpenWindows();
	var fullText = "";

	for (editor in windows)
	{
		var targetDocument = windows[editor];
		var filename = targetDocument.fileName;
		var hasTexExtension = new RegExp(".*tex");
		if(hasTexExtension.test(filename))
		{
			fullText = fullText + targetDocument.text + " ";
		}
		// TODO: Search for citations if the file ends on .bib
		var hasBibExtension = new RegExp(".*bib");
		if(hasBibExtension.test(filename))
		{
			fullText = fullText + " " + getBibtexKeys(targetDocument.text) + " ";
		}
	}

	return(fullText);
}
function getBibtexKeys(inputString)
{
	// Extracts bibtex keys from the inputString.
	// Assumes that inputString is in the bibtex format.
	var bibtexKeyList = "";
	var bibtexTypeAndKey = new RegExp("\@[A-Z]*\{[a-zA-Z0-9]*,", "g");
	var bibtexKey = new RegExp("\{([a-zA-Z0-9]*),");
	var bibtexKeyMatches = inputString.match(bibtexTypeAndKey);
	if(bibtexKeyMatches)
	{
		for(idx = 0; idx < bibtexKeyMatches.length; idx++)
		{
			var tempText = bibtexKeyMatches[idx];
			var matches = tempText.match(bibtexKey);
			var bibtexKeyName = matches[1];
			bibtexKeyList = bibtexKeyList + "\\cite{" + bibtexKeyName + "} "; 
		}
	}
	return(bibtexKeyList);
}
function locateMatchingWordsInString(wordToMatch, parameterText, words)
{
	var searchIndex = 0;
	// TW.target.insertText(parameterText);

	var continueInLoop = true;
	while(continueInLoop)
	{
		continueInLoop = false;
		var tempStart = parameterText.substr(searchIndex).indexOf(wordToMatch);
		if(tempStart > -1)
		{
			var tempEnd = tempStart;
			while(isAlphaNumeric(parameterText.charAt(searchIndex + tempEnd)))
			{
				tempEnd = tempEnd + 1;
			}
			var tempWord = parameterText.substr(searchIndex + tempStart, tempEnd - tempStart);
			if(tempWord.length > wordToMatch.length && !isAlphaNumeric(parameterText.charAt(searchIndex + tempStart - 1)))
			{
				words.push(tempWord);
			}
			searchIndex = searchIndex + tempStart + 1;
			continueInLoop = true;
		}
	}
	return(words);
}
function wordsCleanUp(words, wordToMatch)
{
	// Remove duplicates
	words = unique(words);
	// Ensure that there is at least one word in the words list.
	if(words.length == 0)
	{
		words.push(wordToMatch);
	}
	return(words);
}
// Function that examines all the matching words. 
// The longest common prefix is determined from all the matching words.
function determineLongestCommonInitialSequence(words)
{
	var CommonSequence = words[0];
	var SeqLength = words[0].length;
	if(words.length > 1)
	{
		CommonSequence = words[0];
		for(k = 1; k < words.length; k++)
		{
			for(kk = 0; kk < SeqLength; kk++)
			{
				if(words[0].charAt(kk) != words[k].charAt(kk))
				{
					SeqLength = kk;
					CommonSequence = words[0].substr(0, kk);
				}
			}
		}
	}
	return CommonSequence;
}
function getEndOfCommonSubstring(CommonSequence, extractedWord)
{
	var offset = extractedWord.length;
	var seqLength = CommonSequence.length - extractedWord.length;
	return CommonSequence.substr(offset, seqLength);
}
// Given a list of matching words and the current guess, the function 
// returns the next guess to try.
// If the current guess is empty the first matching word is returned.
function determineNextGuess(words, lastGuess)
{
	// Insert first match after the currently marked section.
	var NextGuess = "";
	if(words.length > 0)
	{
		NextGuess = words[0];
		for(k = 0; k < words.length - 1; k++)
		{
			if(words[k] == lastGuess)
			{
				NextGuess = words[k + 1];
				break;
			}
		}
	}
	return NextGuess;
}
// Function that returns the largest of two input parameters.
function max(a, b)
{
	if(a > b) {
		return(a);
	} else {
		return(b);
	}
}
function showObject(inputObject)
{
	var tempText = "";
	for(prop in inputObject){
		tempText += prop + " -> " + inputObject[prop] + "\n";
	}
	TW.information(null, "Hej", tempText);
}


autocomplete();

// Debug output
//TW.target.selectRange(inputWord.wordStart + 15);
//TW.target.insertText(inputWord.commandName);
//TW.target.selectRange(inputWord.wordStart + CommonSequence.length, max(0, NextGuess.length - CommonSequence.length));
