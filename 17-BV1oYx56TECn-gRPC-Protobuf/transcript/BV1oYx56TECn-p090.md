[00:00] now let's also implement role-based authorization check into our API and for that I'm going to create a new file in utils folder and it's going to be authorized user and this function name is also authorized user
[00:28] and the first argument is going to be the context because because the authentication interceptor is going to add the role to the context and the next argument is going to be a variadic parameter of the allowed roles and this function is going to return just an error
[00:55] now let's extract the user role from the context value and here we need the context key and pass it the role now again we need to do a type assertion and hence a type conversion because this is of type any so we need a string value so let's pass string to the
[01:25] parentheses here and now let's handle the return values and now let's handle the negative okay
[01:53] And now let's match this user role against the allowed roles. So for that we need to range over the allowed roles.
[02:20] And if it is a match then in that case we return a nil error.
[02:35] however if it's not a match then in that case we return an error let it save and now we see that we are using context key here and context key is relevant in this file of the utils folder
[03:02] So let's move the context key from JWT to this file. And let's save this as well. Great.
[03:27] and now we are done with authorized user function actually actually I shouldn't have closed execs file and now in the get execs RPC I'm going to use this authorized user function so let's call utils.authorizeUser
[03:57] And I'm going to pass this the context first. And the second argument is the allowed roles. So let's pass it admin and manager. All right. This is just for testing its functionality.
[04:14] And now let's handle the error.
[04:27] Now let's save this and let's see this in action. So now I'm going to use, and now we need to use someone who is an executive.
[04:57] Jasmine Jackson let's login using her ID and the password is secure password 10
[05:19] Great. Now we have the token. Let's use this. And we get the error. User not authorized for access. Great. And let's use Alice's user ID and password.
[05:45] great and let's use this token now great and now because Alice is an administrator she is able to access this RPC but a user role which is not in the allowed list will not be able to access this RPC excellent
[06:13] And now we can use this code snippet in all our RPCs depending on the client requirements.
[06:19] Thank you.
