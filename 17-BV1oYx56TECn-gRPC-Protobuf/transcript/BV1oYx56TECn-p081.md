[00:00] Now let's implement the login RPC for execs.
[00:24] now here the first thing that we need to do is we need to search if the username that the user entered
[00:52] exists in the database, so we need to connect to the database first.
[01:15] now let's create the filter
[01:44] And now we are going to use find1 to find the entry with this username.
[02:13] and now in order to decode the result we need an instance of models.exec
[02:39] and now let's handle the error
[02:56] and we also need to handle the no documents error and now we are going to let the user know that we were not able to find the user and I like to keep the response
[03:26] So I'm going to respond with incorrect username or password. I'm not going to tell if it's just the username that is incorrect. And next we check the inactive status of the exec. If the user is inactive then in that case we are going to let the user know that account is inactive.
[03:53] and we are not going to go forward with the request and it's going to act like an error.
[04:10] Next we verify the password and we have already copied the verify password function and the hash password function from our REST API. And now let's call verify password function and pass it the password from the request.
[04:35] and from the database.
[04:46] And let's also handle the error.
[05:10] and if there is no error then in that case we issue a JWT and we also have copied the JWT function from our REST API it's going to be the exact same implementation there is no difference between the function for
[05:38] GRPC API or for the REST API. So this is the same function that we are going to use here. So let's call the sine token function and pass the required arguments.
[06:07] and now let's handle the return values
[06:32] And now that we have the token, let's send the token back to the client.
[07:02] All right let's save this and let's restart the server.
[07:24] And now let's send a request to our server for logging in.
[07:40] And let's first login with an incorrect username. Now let's try and login with an incorrect password.
[08:09] Great. All right. Now let's log in with correct information. Great. So we are able to log in and we have received the JSON web token as a response. Perfect. All right. So now our login function is working perfectly. Let's now refactor our code. So all we need to do is extract this part of the code.
[08:38] into a separate function and I'm going to rename this to getUserByUsername and now let's move this over to the
[08:58] crowdfile
[09:11] and now let's fix the return values
[09:32] And this doesn't need the complete request, we only need the username.
[10:02] you
[10:15] you
[10:45] And now let's save this and let's come back to xx.co. Alright and now let's fix this.
[11:11] and we need to include the package name here as well and now we can access error dot error and that's it
[11:37] Let's restart the server to check if there's anything wrong with the refactoring. And we are getting the response. Great. And if I use incorrect password. Great. Incorrect username.
[12:01] and perfect. So our login functionality for execs is working perfectly after the refactoring.
[12:16] you
