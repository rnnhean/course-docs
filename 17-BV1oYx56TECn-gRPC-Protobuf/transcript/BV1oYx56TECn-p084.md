[00:00] Now let's begin working on our forgot password RPC. So let me scroll this above.
[00:29] The first thing that we need to do is extract the email from the request.
[00:58] And now we need to find a document from our MongoDB collection using this email. Now because we are using the email field to find a document in our collection it will be better to index the email field and similar to our SQL database email field should be unique and it's not just the email field
[01:27] We have also used username field to find a document in the collection. And just like our SQL database, both of these fields should be indexed and they both should be unique. We did not configure that earlier, but now is a good time to work on both. I did not bring this up during our login RPC because I wanted to take them both together. The username field as well as the email field.
[01:55] So let's handle them both now. And for that, you can either open up your Mongo shell or you can open MongoDB Compass, which already has a shell. And now that we have two indexes, I'm going to create the first index using the GUI. And then I'm going to create the second index using Mongo shell so that you are experienced with both of the ways.
[02:25] So for creating an index first make sure that you are in the right collection and once you have selected the correct collection then in that collection you should see an indexes tab. Click on this and here we see create index. We also see an existing index for underscore id field and we now want to create another index so click on create index.
[02:52] and now from this drop-down select the field on which you want to create the index. Let's create an index at username and now we need to select a type and this is going to be important for our Mongo shell command as well. So usually the indexes are ascending so you can select ascending one
[03:18] or maybe minus one for descending. And now we also need to make the username field unique. So for that click on options and now click on create unique index. And that is it. We can leave the other options as they are unchecked and only check the create unique index checkbox.
[03:46] Now click on create index and here we have our username index. Now because we are doing that on an existing collection it may fail if you have duplicate values in that field. Fortunately for us in our collection we don't have any duplicate values for username or for email but if you do then in that case the indexing will fail.
[04:15] all right and now let's create an index using MongoDB shell for this we are going to use school database and then we are going to use the command db dot execs dot create index great
[04:42] and you see that we have option to create multiple index by using create indexes and similarly we could create multiple indexes using the GUI as well by clicking on this plus button. So by clicking on this plus button you can create as many indexes as possible.
[05:10] all right let's come back to our MongoDB shell and here we are going to create one index all right and the index needs to be created on the field email and we need the index to be in ascending order so one right we've already seen that ascending means one now we need to use a comma
[05:39] and if we want to create a unique index then in that case we need to pass another argument and in the second argument we need to mention that unique is true and that is it and now if we hit refresh in the indexes tab we now have the third index as well and
[06:08] It is also unique. Great and now let's get back to our forgot password RPC and now let's create the MongoDB client and handle the return values.
[06:33] All right, so now that we have our client ready, let's find a document from the collection using this email.
[07:03] you
[07:10] And now in order to decode the result we need an instance of models.exec.
[07:37] and let's also handle the error and inside the error we also need to handle the edge case which is
[08:04] Add no documents.
[08:19] And now let's create the token that we are going to send to the user and also the token that we are going to store in our collection. And for that we are going to implement the same mechanism.
[08:43] So let's create a blank byte slice of 32 length. Alright and now let's read random bytes into this blank.
[09:07] byte slice. Well, it's giving us an error because it's not automatically
[09:34] importing the correct package it should be crypto-rand and now the error should go away and the error is gone and now let's handle the error appropriately
[09:58] Now that we have the byte slice ready, let's create the token by encoding this byte slice to string.
[10:27] We also need to create a hashed token using the same byte slice. So let's create that as well. And again for this we are going to use SHA256. And now we need to convert this hashed token into a string.
[10:52] for it to be used. Perfect. And now we also need the duration for which this reset token will be valid.
[11:17] so that has already been saved in the .en file reset token expiration so let's call this now when we extract the data from environment variables it's going to be a string and we need to now convert that to an integer
[11:46] let's copy the environment variable name from the .n file and we need to handle the return values from a to i method
[12:16] You can use internal letter or you can use failed to send password reset email as the error message as well.
[12:38] now that we have the duration in integer we can convert that to a time duration and we are going to store the duration in a min's variable which stands for minutes we need to call time dot duration and pass it this and pass it the duration as an argument
[13:06] and now that we have the duration we can now calculate the expiry by calling time dot now dot add and then mince multiplied by time dot minute.
[13:30] And now because we are going to save the expiry time in our database collection we need to format this time appropriately. Now that we have the expiry time and the token string ready let's save that into our database collection.
[13:57] and we are going to search for the appropriate document using the email. Because the email field is indexed and it is a unique field.
[14:25] and now the update argument is going to be a little longer so let's create a variable to store that
[14:52] Now here we need to set a value so dollar set and again bson.m
[15:06] Now the fields that we are updating are password reset token and password token expires.
[15:28] Great. So the hashed token string is passed to the password reset token and the expiry has been passed to the password token expires.
[15:53] And now we can pass the update to the update1 method. And this time we are discarding the result and handling the error.
[16:15] if there is no error in saving the expiry and the hash token string into the database then we now need to prepare the
[16:32] reset URL and the message.
[16:53] And now let's also create the message.
[17:23] you
[17:52] you
[18:17] you
[18:46] you
[19:16] And finally the subject. Now I know that we are creating a GRPC API and we don't have HTTPS localhost server that will be hosting this.
[19:46] But maybe just for hosting this one URL, you can create an HTTP server. Alright, however, what we are going to do is we are still sending the token in this message. And this token is going with our GRPC response. And we already have the mechanism in place for reset password, where the user is sending us this token through the GRPC request.
[20:15] but I just included this functionality because optionally you can create an HTTP server just for one route for handling any reset password request if you want to. Otherwise it can be done with just gRPC as well. All right send the token instead of a URL with a gRPC response and let the user know that when you want to reset the password you need to use the token along with your new password.
[20:43] And that is exactly what we are going to implement here. But we are still going to keep it like this with the reset URL.
[20:53] Alright, so now we already have imported the package go mail. So let's use that to send email to the client.
[21:23] you
[21:41] you
[22:11] All right, so now that we have configured our message, it's now time to send this message. And we need to use the port 1025 to send this message. So let's call mail dot new dialer.
[22:40] And optionally you can save both of these values the host as well as the port inside your .env file inside the environment variables so that you don't have to disclose this information inside your code. I'm just going to keep them as they are for training purposes.
[23:08] Now this is going to create a new instance of dialer and on this instance on this object we are going to call its method dial and send to send the email and to the dial and send method we need to pass the email the message M.
[23:26] and let's handle the error and now if we have an error then in that case
[23:56] We need to access the database again and clean up the fields password reset token and password token expires. So let's do that. And for that I'm going to introduce a new variable cleanup and this is going to be same as update.
[24:12] but it's going to have nil values.
[24:27] And now let's also copy the query where we update these values into the execs collection and there's no point in handling the error. So we are going to discard the error. So no point in copying the error handling part as well.
[24:55] So just copy this line.
[25:05] And now if there is no error we are going to return the response.
[25:26] And I forgot to change this to cleanup. So let's change this. And there we go. Great. All right. And now let's save this and start the server.
[25:53] and now we need an email address so let's actually first try with this because this should not be found in database and let's see what and let's see what response we receive great and now let's copy
[26:13] All right, so while we are running our server, we also need to start the MailHawk server.
[26:42] We've already installed it. So let's start the MailHawk server. And we don't need to restart the server because there's nothing changed on our gRPC server. Alright, let's send the request. And here we go. We have the response here and it has the code that we can use with our
[27:10] Next request for resetting the password. Great, now let's refactor our code. So, we are using database here as well. So, it's all going to be extracted.
[27:38] and I'm going to rename this to forgot password DB and you may choose not to refactor this that's also okay but I am actually going to refactor this
[28:04] now let's take a look at the return values and what do we need here we just need the message and this function will need the email so so the parameters in the signature are correct let's also fix the
[28:34] Return values. So we just need the message or an error. That's it.
[29:03] And save.
[29:29] now we still have one error what happened if you also see the same error then just add V2 at the end and save it that's it now let's fix the forgot password RPC
[29:58] and that's it. Now let's check the error handling in the crud function.
[30:21] All right, so we are calling the error handler in all the errors. Great. Let's restart the server to check if there is anything wrong after refactoring. Let's add some other values here. Great.
[30:51] Now, perfect. And before we finish the lecture, let me also show you the mail hog inbox where we have received both the emails. Alright, so our forgot password RPC is also complete now.
[31:11] Thank you.
