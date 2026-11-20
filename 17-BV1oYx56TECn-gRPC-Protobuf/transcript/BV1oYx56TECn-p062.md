[00:00] Now as we are handling error this way we do feel the need to implement an error handler and we have done that in the past in our REST API. So let's do that here as well before we start with defining our handlers or CRUD operations.
[00:21] So we are going to create the error handler in the utils folder.
[00:33] And this is going to be a funk error handler. And it's going to take the error as its first argument.
[01:02] and message as its second argument. And we know that it's going to return an error. Now let's create an error logger just like last time and this is going to be log dot new.
[01:26] and we are going to provide it the standard error output as the first argument and the next argument is going to be the prefix which is error and let's include the flags as well so log dot L date and then log dot L time
[01:55] and log dot l short file now let's call the error logger dot println and we need the message as well as the error and now finally we return the message as an error so for that we call fmt dot
[02:25] errorF and pass the messages argument. That's it. And now here I'm going to call utils.errorHandler and pass it the error.
[02:45] as well as a message and here as well
[03:14] and that's it and similarly in our server.go file here we are actually using log.fatal so that's fine all right so now let me close all these open files
[03:42] That's it and now we are going to work on the files that we are going to create for handler and CRUD operations.
[03:50] you
